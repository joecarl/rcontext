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

// Independent entity set
ctx.addEntitySet({
    name: 'mySet1',
    keys: ['id'],
    parentKeys: []
});

// Entity set whose parent is mySet1
ctx.addEntitySet({
    name: 'mySet2',
    keys: ['id'],
    parentKeys: [
        {
            entitySet: 'mySet1',
            props: ['parentId']
        }
    ]
});
```

### Add entities

```ts
// Add an independent entity
const ent1 = ctx.trackObject('mySet1', { id: 1, name: 'My entity 1' });

// Add an entity whose parent will be ent1
const ent2 = ctx.trackObject('mySet2', { id: 5, parentId: 1, name: 'My entity 2' });
```

### Play with state

```ts
// Relationships will be automatically generated in the state
const state = ctx.getState();

// Managing state directly might be a bit tedious; better use this helper class
const stateHelper = new RContextStateHelper(state);

// Get children of ent1 whose entitySet is 'mySet2'
const children = stateHelper.getChildren(ent1, 'mySet2'); 

// Get the parent of ent2 whose entitySet is 'mySet1'
const parent = stateHelper.getParent(ent2, 'mySet1'); 
```

Please note that the methods in `RContextStateHelper` never return pure entities. Instead, they return immutable state objects, which include a reference to the corresponding pure entity for convenience.

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
ent2.edit({ name: 'New name for this entity!' });

// Add an entity in creation mode
const ent3 = ctx.createObject('mySet1', { name: 'My entity 3' });

// Generate the composite request object, which will include all the necessary
// information for the server to update the remote data.
// In this case, it will contain information to create `ent3` and update the
// `name` property of `ent2`.
const requests = ctx.buildRequests();

// Send the generated object to the server and handle the information there 
// (there are official implementations for handling these requests in PHP and C#)
const response = await myFunctionToSendTheObjectToTheServer(requests);

// Synchronize the local context with the server response
ctx.sync(response);
```