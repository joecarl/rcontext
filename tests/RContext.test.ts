import { test, expect } from 'vitest';
import { RContext } from '../src/RContext';
import { RemoteEntityObject } from '../src/RemoteEntityObject';

function createContext() {
	const ctx = new RContext();

	// Indepedent entity set
	ctx.addEntitySet({
		name: 'entitySet1',
		keys: ['id'],
		parentKeys: []
	});

	// Indepedent entity set
	ctx.addEntitySet({
		name: 'entitySet1b',
		keys: ['id'],
		parentKeys: []
	});

	// Entity set whose parent is entitySet1
	ctx.addEntitySet({
		name: 'entitySet2',
		keys: ['id'],
		parentKeys: [
			{
				entitySet: 'entitySet1',
				props: ['parentId']
			}
		]
	});

	// Entity set whose parent is itself
	ctx.addEntitySet({
		name: 'entitySet3',
		keys: ['id'],
		parentKeys: [
			{
				entitySet: 'entitySet3',
				props: ['parentId']
			}
		]
	});

	// Entity set with multiple parents
	ctx.addEntitySet({
		name: 'entitySet4',
		keys: ['id'],
		parentKeys: [
			{
				entitySet: 'entitySet1',
				props: ['parentId']
			},
			{
				entitySet: 'entitySet1b',
				props: ['parentIdB']
			}
		]
	});

	return ctx;
}


test('adding related objects creates relationships in state', () => {

	const ctx = createContext();

	const obj1 = { id: 1, name: 'ent1' };
	const obj2 = { id: 2, parentId: 1, name: 'ent2' };

	const ent2 = ctx.trackObject('entitySet2', obj2);
	const ent1 = ctx.trackObject('entitySet1', obj1);

	const state = ctx.getState();

	const chSet = state.map[ent1.localUid].childrenSets['entitySet2'];
	expect(chSet).toBeTruthy();

	const chUid = chSet[0];
	expect(chUid).toBe(ent2.localUid);
	const ch = state.map[chUid];
	expect(ch).toBeTruthy();
	expect(ch.data).toMatchObject({ ...obj2 });

	const parentUid = state.map[ent2.localUid].parentsMap['entitySet1'];
	expect(parentUid).toBe(ent1.localUid);
	const parent = state.map[parentUid];
	expect(parent).toBeTruthy();
	expect(parent.data).toMatchObject({ ...obj1 });
});


test('removing related objects removes relationships in state', () => {

	const ctx = createContext();

	const obj1 = { id: 1, name: 'ent1' };
	const obj2 = { id: 2, parentId: 1, name: 'ent2' };

	const ent2 = ctx.trackObject('entitySet2', obj2);
	const ent1 = ctx.trackObject('entitySet1', obj1);

	ent1.removeImmediately();

	const state = ctx.getState();

	const ient1 = state.map[ent1.localUid];
	expect(ient1).toBeFalsy();

	const parentUid = state.map[ent2.localUid].parentsMap['entitySet1'];
	expect(parentUid).toBeFalsy();
});


test('adding related objects with missing parent does not create relationships in state', () => {

	const ctx = createContext();

	const obj2 = { id: 2, parentId: 1, name: 'ent2' };

	const ent2 = ctx.trackObject('entitySet2', obj2);

	const state = ctx.getState();

	const parentUid = state.map[ent2.localUid].parentsMap['entitySet1'];
	expect(parentUid).toBeFalsy();
});


test('adding related objects in async events still creates relationships in state', async () => {

	const ctx = createContext();

	const obj1 = { id: 1, name: 'ent1' };
	const obj2 = { id: 2, parentId: 1, name: 'ent2' };

	const ent2 = ctx.trackObject('entitySet2', obj2);

	const ent1 = await new Promise<RemoteEntityObject<any>>(resolve => {
		setTimeout(() => {
			const ent1 = ctx.trackObject('entitySet1', obj1);
			resolve(ent1);
		}, 200);
	});

	expect(ent1).toBeTruthy();

	const state = ctx.getState();

	const chSet = state.map[ent1.localUid].childrenSets['entitySet2'];
	expect(chSet).toBeTruthy();

	const chUid = chSet[0];
	expect(chUid).toBe(ent2.localUid);
	const ch = state.map[chUid];
	expect(ch).toBeTruthy();
	expect(ch.data).toMatchObject({ ...obj2 });

	const parentUid = state.map[ent2.localUid].parentsMap['entitySet1'];
	expect(parentUid).toBe(ent1.localUid);
	const parent = state.map[parentUid];
	expect(parent).toBeTruthy();
	expect(parent.data).toMatchObject({ ...obj1 });
});


test('adding entity with null parent key does not create relationships in state and does not store the entity as an orphan', () => {

	const ctx = createContext();

	const obj = { id: 2, parentId: null, name: 'ent' };

	const ent = ctx.trackObject('entitySet3', obj);

	const state = ctx.getState();

	const parentUid = state.map[ent.localUid].parentsMap['entitySet1'];
	expect(parentUid).toBeFalsy();

	const orphans = ctx.getOrphanEntities();
	expect(orphans).toHaveLength(0);
});


test('adding entity with defined parent key but missing parent does not create relationships in state and stores it as an orphan', () => {

	const ctx = createContext();

	const obj = { id: 2, parentId: 1, name: 'ent' };

	const ent = ctx.trackObject('entitySet3', obj);

	const state = ctx.getState();

	const parentUid = state.map[ent.localUid].parentsMap['entitySet1'];
	expect(parentUid).toBeFalsy();

	const orphans = ctx.getOrphanEntities();
	expect(orphans).toHaveLength(1);
	expect(orphans[0]).toMatchObject(ent);
});

test('adding one of the missing parents of an orphan entity with multiple parents creates the relationship but keeps it in the orphan list', () => {

	const ctx = createContext();

	const obj1 = { id: 1, name: 'ent1' };
	const obj2 = { id: 2, parentId: 1, parentIdB: 1, name: 'ent2' };

	const ent2 = ctx.trackObject('entitySet4', obj2);

	const orphans = ctx.getOrphanEntities();
	expect(orphans).toHaveLength(1);
	expect(orphans[0]).toMatchObject(ent2);

	const ent1 = ctx.trackObject('entitySet1', obj1);
	const state = ctx.getState();

	const parentUid = state.map[ent2.localUid].parentsMap['entitySet1'];
	expect(parentUid).toBe(ent1.localUid);

	const orphans2 = ctx.getOrphanEntities();
	expect(orphans2).toHaveLength(1);
	expect(orphans2[0]).toMatchObject(ent2);
});


test('adding both missing parents of an orphan entity with multiple parents creates the relationship and removes it from the orphan list', () => {

	const ctx = createContext();

	const obj1 = { id: 1, name: 'ent1' };
	const obj1b = { id: 1, name: 'ent1b' };
	const obj2 = { id: 2, parentId: 1, parentIdB: 1, name: 'ent2' };

	const ent2 = ctx.trackObject('entitySet4', obj2);

	const orphans = ctx.getOrphanEntities();
	expect(orphans).toHaveLength(1);
	expect(orphans[0]).toMatchObject(ent2);

	const ent1 = ctx.trackObject('entitySet1', obj1);
	
	const orphans2 = ctx.getOrphanEntities();
	expect(orphans2).toHaveLength(1);
	expect(orphans2[0]).toMatchObject(ent2);

	const ent1b = ctx.trackObject('entitySet1b', obj1b);
	const state = ctx.getState();

	const parentUid = state.map[ent2.localUid].parentsMap['entitySet1'];
	expect(parentUid).toBe(ent1.localUid);
	const parentUidB = state.map[ent2.localUid].parentsMap['entitySet1b'];
	expect(parentUidB).toBe(ent1b.localUid);

	const orphans3 = ctx.getOrphanEntities();
	expect(orphans3).toHaveLength(0);
});


test('editing an entity props updates the state', () => {

	const ctx = createContext();

	const obj1 = { id: 1, name: 'ent1' };
	const ent1 = ctx.trackObject('entitySet1', obj1);

	ent1.edit({ name: 'entidad1' });

	const state = ctx.getState();

	const ient1 = state.map[ent1.localUid];
	expect(ient1.data.name).toBe('entidad1');
});

test('building a request for an entity whose parent is in creation mode also builds the parent request', () => {

	const ctx = createContext();

	const obj1 = { name: 'ent1' };
	const ent1 = ctx.createObject('entitySet1', obj1);

	const obj2 = { name: 'ent2' };
	const ent2 = ctx.createObject('entitySet1', obj1);

	const obj3 = { parentId: ent1.toRelationalKey(), name: 'ent3' };
	const ent3 = ctx.createObject('entitySet2', obj3);

	const reqs = ctx.buildRequestsForUids([ent3.localUid]);
	
	// The request dictionary must have 2 elements and specifically they must be ent1 and ent3
	expect(Object.keys(reqs)).toHaveLength(2);
	expect(reqs[ent1.localUid]).toBeTruthy();
	expect(reqs[ent3.localUid]).toBeTruthy();
});	