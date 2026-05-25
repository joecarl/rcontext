# RContext

RContext stands for Remote, Reactive, Real-time, and Reliable context management. It's a JavaScript library designed to manage relationships between entities, handle CRUD operations (create, read, update, delete), and synchronize state seamlessly with a remote server. It bundles changes into efficient requests, interprets server responses to keep the frontend state in sync, and emits real-time state updates for any modifications in the context. It's perfect for building reactive, data-driven applications with minimal boilerplate.

## Relationships

Entity relationships are automatically determined based on the provided set definitions. The main rule is that an entity can have **multiple children within each entity set** but **only one parent per set**.

When child entities are added to the context, their relationships with their parents are stored in the state. This state keeps track of relationships in both directions, allowing quick access to an entity’s parents or children.

If a child entity is added before its parent, the relationship cannot be created immediately. In this case, the child is temporarily stored as an orphan. Once the parent is added later, the relationship is established, and the child is removed from the orphan list.

## Example:

### Define your sets
```ts
const ctx = new RContext();

interface User {
    id: number;
    name: string;
}

interface Post {
    id: number;
    authorId: number;
    title: string;
}

// Independent entity set
// addEntitySet<T>() returns a typed EntitySet<T> handle
const userSet = ctx.addEntitySet<User>({
    name: 'users',
    keys: ['id'],
});

// Entity set whose parent is userSet — reference the EntitySet instance directly
const postSet = ctx.addEntitySet<Post>({
    name: 'posts',
    keys: ['id'],
    parentKeys: [
        {
            entitySet: userSet,   // typed EntitySet<User>, no magic strings
            props: ['authorId'],
        }
    ],
});
```

For self-referential sets, use `addParentKey()` after creation:

```ts
interface Category {
    id: number;
    parentId: number | null;
    name: string;
}

const categorySet = ctx.addEntitySet<Category>({
    name: 'categories',
    keys: ['id'],
});
categorySet.addParentKey({ entitySet: categorySet, props: ['parentId'] });
```

### Add entities

```ts
// Track an existing remote entity (fetched from the server)
const user1 = userSet.trackObject({ id: 1, name: 'Alice' });

// Track an entity whose parent will be user1
const post1 = postSet.trackObject({ id: 5, authorId: 1, title: 'Hello world' });

// Create a new entity locally (not yet synced with the server)
const newPost = postSet.createObject({ authorId: user1.toRelationalKey(), title: 'New post' });
```

### Play with state

```ts
// Relationships will be automatically generated in the state
const state = ctx.getState();

// Managing state directly might be a bit tedious; better use this helper class
const stateReader = ctx.createStateReader(state); // Creates a new instance of RContextStateReader

// Get children of user1 in postSet
const posts = stateReader.getChildren(user1, postSet);

// Get the parent of post1 in userSet
const author = stateReader.getParent(post1, userSet);

// Get all entities in a set
const allPosts = stateReader.getEntities(postSet);

// Find a specific entity by key
const found = stateReader.findEntity(postSet, 5);
```

Please note that the methods in `RContextStateReader` never return pure entities. Instead, they return immutable state objects, which include a reference to the corresponding pure entity for convenience.

### Use it in your reactive app

```ts
// Instead of accessing the state directly from the context, in reactive apps,
// it’s better to use the event listener. This approach is more efficient 
// because the event is triggered asynchronously and skips unnecessary updates.
ctx.onContextChange = (newContextState) => {
    // Code to update my reactive app state
};
```

### Edit your data, build requests, and sync with your server
```ts
// Edit an existing entity
post1.edit({ title: 'Updated title' });

// Discard all unsaved changes (reverts to last synced state, or removes if 'create')
post1.discardChanges();

// Remove from context without marking for deletion — server is not notified
post1.untrack();

// Mark for deletion (server will be notified on next sync)
post1.remove();

// Generate the composite request object, which will include all the necessary
// information for the server to update the remote data.
const requests = ctx.buildRequests();

// Send the generated object to the server and handle the information there
// (there are official implementations for handling these requests in PHP and C#)
const response = await myFunctionToSendTheObjectToTheServer(requests);

// Synchronize the local context with the server response
ctx.sync(response);
```