import { test, expect } from 'vitest';
import { RContext } from '../src/RContext';
import { RemoteEntityObject } from '../src/RemoteEntityObject';
import { createContext } from './testContext';


test('adding related objects creates relationships in state', () => {

	const { ctx, set1, set3 } = createContext();

	const childObj = { id: 2, parentId: 1, name: 'ent2' };
	const childEnt = set3.trackObject(childObj);

	const parentObj = { id: 1, name: 'ent1' };
	const parentEnt = set1.trackObject(parentObj);

	const state = ctx.getState();

	const chSet = state.map[parentEnt.localUid].childrenSets['set3_dependsOn_set1'];
	expect(chSet).toBeTruthy();

	const chUid = chSet[0];
	expect(chUid).toBe(childEnt.localUid);
	const ch = state.map[chUid];
	expect(ch).toBeTruthy();
	expect(ch.data).toMatchObject({ ...childObj });

	const parentUid = state.map[childEnt.localUid].parentsMap['set1_independant'];
	expect(parentUid).toBe(parentEnt.localUid);
	const parent = state.map[parentUid];
	expect(parent).toBeTruthy();
	expect(parent.data).toMatchObject({ ...parentObj });
});


test('removing related objects removes relationships in state', () => {

	const { ctx, set1, set3 } = createContext();

	const childObj = { id: 2, parentId: 1, name: 'ent2' };
	const childEnt = set3.trackObject(childObj);

	const parentObj = { id: 1, name: 'ent1' };
	const parentEnt = set1.trackObject(parentObj);

	parentEnt.removeImmediately();

	const state = ctx.getState();

	const ient1 = state.map[parentEnt.localUid];
	expect(ient1).toBeFalsy();

	const parentUid = state.map[childEnt.localUid].parentsMap['set1_independant'];
	expect(parentUid).toBeFalsy();
});


test('adding related objects in async events still creates relationships in state', async () => {

	const { ctx, set1, set3 } = createContext();

	const childObj = { id: 2, parentId: 1, name: 'ent2' };
	const childEnt = set3.trackObject(childObj);

	const parentObj = { id: 1, name: 'ent1' };
	const parentEnt = await new Promise<RemoteEntityObject<any>>(resolve => {
		setTimeout(() => {
			const ent1 = set1.trackObject(parentObj);
			resolve(ent1);
		}, 200);
	});

	expect(parentEnt).toBeTruthy();

	const state = ctx.getState();

	const chSet = state.map[parentEnt.localUid].childrenSets['set3_dependsOn_set1'];
	expect(chSet).toBeTruthy();

	const chUid = chSet[0];
	expect(chUid).toBe(childEnt.localUid);
	const ch = state.map[chUid];
	expect(ch).toBeTruthy();
	expect(ch.data).toMatchObject({ ...childObj });

	const parentUid = state.map[childEnt.localUid].parentsMap['set1_independant'];
	expect(parentUid).toBe(parentEnt.localUid);
	const parent = state.map[parentUid];
	expect(parent).toBeTruthy();
	expect(parent.data).toMatchObject({ ...parentObj });
});


test('adding entity with null parent key does not create relationships in state and does not store the entity as an orphan', () => {

	const { ctx, set4 } = createContext();

	const obj = { id: 2, parentId: null, name: 'ent' };
	const ent = set4.trackObject(obj);

	const state = ctx.getState();

	const parentUid = state.map[ent.localUid].parentsMap['set1_independant'];
	expect(parentUid).toBeFalsy();

	const orphans = ctx.getOrphanEntities();
	expect(orphans).toHaveLength(0);
});


test('adding related objects with missing parent does not create relationships in state and stores it as an orphan', () => {

	const { ctx, set3 } = createContext();

	const orphanObj = { id: 2, parentId: 1, name: 'ent2' };
	const orphanEnt = set3.trackObject(orphanObj);

	const state = ctx.getState();

	const parentUid = state.map[orphanEnt.localUid].parentsMap['set1_independant'];
	expect(parentUid).toBeFalsy();

	const orphans = ctx.getOrphanEntities();
	expect(orphans).toHaveLength(1);
	expect(orphans[0]).toMatchObject(orphanEnt);
});


test('adding one of the missing parents of an orphan entity with multiple parents creates the relationship but keeps it in the orphan list', () => {

	const { ctx, set1, set5 } = createContext();

	const childObj = { id: 2, parentId: 1, parentIdB: 1, name: 'ent2' };
	const childEnt = set5.trackObject(childObj);

	const orphans = ctx.getOrphanEntities();
	expect(orphans).toHaveLength(1);
	expect(orphans[0]).toMatchObject(childEnt);

	const parentObj = { id: 1, name: 'ent1' };
	const parentEnt = set1.trackObject(parentObj);

	const state = ctx.getState();

	const parentUid = state.map[childEnt.localUid].parentsMap['set1_independant'];
	expect(parentUid).toBe(parentEnt.localUid);

	const orphans2 = ctx.getOrphanEntities();
	expect(orphans2).toHaveLength(1);
	expect(orphans2[0]).toMatchObject(childEnt);
});


test('adding both missing parents of an orphan entity with multiple parents creates the relationship and removes it from the orphan list', () => {

	const { ctx, set1, set2, set5 } = createContext();

	const childObj = { id: 2, parentId: 1, parentIdB: 1, name: 'ent2' };
	const childEnt = set5.trackObject(childObj);

	const orphans = ctx.getOrphanEntities();
	expect(orphans).toHaveLength(1);
	expect(orphans[0]).toMatchObject(childEnt);

	const parentObj1 = { id: 1, name: 'ent1' };
	const parentEnt1 = set1.trackObject(parentObj1);

	const orphans2 = ctx.getOrphanEntities();
	expect(orphans2).toHaveLength(1);
	expect(orphans2[0]).toMatchObject(childEnt);

	const parentObj2 = { id: 1, name: 'ent1b' };
	const parentEnt2 = set2.trackObject(parentObj2);

	const state = ctx.getState();

	// Check parents map
	const parentUid = state.map[childEnt.localUid].parentsMap['set1_independant'];
	expect(parentUid).toBe(parentEnt1.localUid);
	const parentUidB = state.map[childEnt.localUid].parentsMap['set2_independant'];
	expect(parentUidB).toBe(parentEnt2.localUid);

	// Check children set
	const chSet = state.map[parentEnt1.localUid].childrenSets['set5_dependsOn_set1_and_set2'];
	expect(chSet).toBeTruthy();
	expect(chSet).toHaveLength(1);
	expect(chSet[0]).toBe(childEnt.localUid);

	// Check orphans
	const orphans3 = ctx.getOrphanEntities();
	expect(orphans3).toHaveLength(0);
});


test('editing an entity props updates the state', () => {

	const { ctx, set1 } = createContext();

	const obj = { id: 1, name: 'ent1' };
	const ent = set1.trackObject(obj);

	ent.edit({ name: 'entidad1' });

	const state = ctx.getState();

	const ient = state.map[ent.localUid];
	expect(ient.data.name).toBe('entidad1');
});


test('building a request for an entity whose parent is in creation mode also builds the parent request', () => {

	const { ctx, set1, set3 } = createContext();

	const parentObj = { name: 'ent1' };
	const parentEnt = set1.createObject(parentObj);

	const otherObj = { name: 'ent2' };
	const otherEnt = set1.createObject(otherObj);

	const childObj = { parentId: parentEnt.toRelationalKey() as number, name: 'ent3' };
	const childEnt = set3.createObject(childObj);

	const reqs = ctx.buildRequestsForUids([childEnt.localUid]);

	// The request dictionary must have 2 elements and specifically they must be parentEnt and childEnt
	expect(Object.keys(reqs)).toHaveLength(2);
	expect(reqs[parentEnt.localUid]).toBeTruthy();
	expect(reqs[childEnt.localUid]).toBeTruthy();
});


test('onContextChange event is triggered only once after multiple synchronous changes', async () => {

	const { ctx, set1, set3 } = createContext();

	let eventCount = 0;
	ctx.onContextChange = () => { eventCount++; };

	const parentObj = { name: 'ent1' };
	const parentEnt = set1.createObject(parentObj);

	const otherObj = { name: 'ent2' };
	const otherEnt = set1.createObject(otherObj);

	const childObj = { parentId: parentEnt.toRelationalKey() as number, name: 'ent3' };
	const childEnt = set3.createObject(childObj);

	await new Promise(resolve => setTimeout(resolve, 100));

	expect(eventCount).toBe(1);
});


test('adding the same entity twice and then adding the parent entity does not cause any problem when creating the corresponding relationships', () => {

	const { ctx, set1, set3 } = createContext();

	const childObj = { id: 2, parentId: 1, name: 'ent2' };
	const childEntT1 = set3.trackObject(childObj);
	const childEntT2 = set3.trackObject(childObj);

	expect(childEntT1).toBe(childEntT2);

	const orphans = ctx.getOrphanEntities();
	expect(orphans).toHaveLength(1);
	expect(orphans[0]).toMatchObject(childEntT1);

	const parentObj = { id: 1, name: 'ent1' };
	const parentEnt = set1.trackObject(parentObj);

	const state = ctx.getState();

	const parentUid = state.map[childEntT1.localUid].parentsMap['set1_independant'];
	expect(parentUid).toBe(parentEnt.localUid);

	const orphans2 = ctx.getOrphanEntities();
	expect(orphans2).toHaveLength(0);
});

test('removing immediately an orphan entity also removes it form the orphans list', () => {

	const { ctx, set3 } = createContext();

	const childObj = { id: 2, parentId: 1, name: 'ent1' };
	const childEnt = set3.trackObject(childObj);

	const orphans = ctx.getOrphanEntities();
	expect(orphans).toHaveLength(1);

	childEnt.removeImmediately();

	const orphans2 = ctx.getOrphanEntities();
	expect(orphans2).toHaveLength(0);
});
