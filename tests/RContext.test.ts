import { test, expect } from 'vitest';
import { RContext } from '../src/RContext';
import { RemoteEntityObject } from '../src/RemoteEntityObject';
import { createContext } from './testContext';


test('adding related objects creates relationships in state', () => {

	const ctx = createContext();

	const childObj = { id: 2, parentId: 1, name: 'ent2' };
	const childEnt = ctx.trackObject('set3_dependsOn_set1', childObj);

	const parentObj = { id: 1, name: 'ent1' };
	const parentEnt = ctx.trackObject('set1_independant', parentObj);

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

	const ctx = createContext();

	const childObj = { id: 2, parentId: 1, name: 'ent2' };
	const childEnt = ctx.trackObject('set3_dependsOn_set1', childObj);

	const parentObj = { id: 1, name: 'ent1' };
	const parentEnt = ctx.trackObject('set1_independant', parentObj);

	parentEnt.removeImmediately();

	const state = ctx.getState();

	const ient1 = state.map[parentEnt.localUid];
	expect(ient1).toBeFalsy();

	const parentUid = state.map[childEnt.localUid].parentsMap['set1_independant'];
	expect(parentUid).toBeFalsy();
});


test('adding related objects in async events still creates relationships in state', async () => {

	const ctx = createContext();

	const childObj = { id: 2, parentId: 1, name: 'ent2' };
	const childEnt = ctx.trackObject('set3_dependsOn_set1', childObj);

	const parentObj = { id: 1, name: 'ent1' };
	const parentEnt = await new Promise<RemoteEntityObject<any>>(resolve => {
		setTimeout(() => {
			const ent1 = ctx.trackObject('set1_independant', parentObj);
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

	const ctx = createContext();

	const obj = { id: 2, parentId: null, name: 'ent' };
	const ent = ctx.trackObject('set4_dependsOn_itself', obj);

	const state = ctx.getState();

	const parentUid = state.map[ent.localUid].parentsMap['set1_independant'];
	expect(parentUid).toBeFalsy();

	const orphans = ctx.getOrphanEntities();
	expect(orphans).toHaveLength(0);
});


test('adding related objects with missing parent does not create relationships in state and stores it as an orphan', () => {

	const ctx = createContext();

	const orphanObj = { id: 2, parentId: 1, name: 'ent2' };
	const orphanEnt = ctx.trackObject('set3_dependsOn_set1', orphanObj);

	const state = ctx.getState();

	const parentUid = state.map[orphanEnt.localUid].parentsMap['set1_independant'];
	expect(parentUid).toBeFalsy();

	const orphans = ctx.getOrphanEntities();
	expect(orphans).toHaveLength(1);
	expect(orphans[0]).toMatchObject(orphanEnt);
});


test('adding one of the missing parents of an orphan entity with multiple parents creates the relationship but keeps it in the orphan list', () => {

	const ctx = createContext();

	const childObj = { id: 2, parentId: 1, parentIdB: 1, name: 'ent2' };
	const childEnt = ctx.trackObject('set5_dependsOn_set1_and_set2', childObj);

	const orphans = ctx.getOrphanEntities();
	expect(orphans).toHaveLength(1);
	expect(orphans[0]).toMatchObject(childEnt);

	const parentObj = { id: 1, name: 'ent1' };
	const parentEnt = ctx.trackObject('set1_independant', parentObj);

	const state = ctx.getState();

	const parentUid = state.map[childEnt.localUid].parentsMap['set1_independant'];
	expect(parentUid).toBe(parentEnt.localUid);

	const orphans2 = ctx.getOrphanEntities();
	expect(orphans2).toHaveLength(1);
	expect(orphans2[0]).toMatchObject(childEnt);
});


test('adding both missing parents of an orphan entity with multiple parents creates the relationship and removes it from the orphan list', () => {

	const ctx = createContext();

	const childObj = { id: 2, parentId: 1, parentIdB: 1, name: 'ent2' };
	const childEnt = ctx.trackObject('set5_dependsOn_set1_and_set2', childObj);

	const orphans = ctx.getOrphanEntities();
	expect(orphans).toHaveLength(1);
	expect(orphans[0]).toMatchObject(childEnt);

	const parentObj1 = { id: 1, name: 'ent1' };
	const parentEnt1 = ctx.trackObject('set1_independant', parentObj1);

	const orphans2 = ctx.getOrphanEntities();
	expect(orphans2).toHaveLength(1);
	expect(orphans2[0]).toMatchObject(childEnt);

	const parentObj2 = { id: 1, name: 'ent1b' };
	const parentEnt2 = ctx.trackObject('set2_independant', parentObj2);

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

	const ctx = createContext();

	const obj = { id: 1, name: 'ent1' };
	const ent = ctx.trackObject('set1_independant', obj);

	ent.edit({ name: 'entidad1' });

	const state = ctx.getState();

	const ient = state.map[ent.localUid];
	expect(ient.data.name).toBe('entidad1');
});


test('building a request for an entity whose parent is in creation mode also builds the parent request', () => {

	const ctx = createContext();

	const parentObj = { name: 'ent1' };
	const parentEnt = ctx.createObject('set1_independant', parentObj);

	const otherObj = { name: 'ent2' };
	const otherEnt = ctx.createObject('set1_independant', parentObj);

	const childObj = { parentId: parentEnt.toRelationalKey(), name: 'ent3' };
	const childEnt = ctx.createObject('set3_dependsOn_set1', childObj);

	const reqs = ctx.buildRequestsForUids([childEnt.localUid]);

	// The request dictionary must have 2 elements and specifically they must be parentEnt and childEnt
	expect(Object.keys(reqs)).toHaveLength(2);
	expect(reqs[parentEnt.localUid]).toBeTruthy();
	expect(reqs[childEnt.localUid]).toBeTruthy();
});


test('onContextChange event is triggered only once after multiple synchronous changes', async () => {

	const ctx = createContext();

	let eventCount = 0;
	ctx.onContextChange = () => { eventCount++; };

	const parentObj = { name: 'ent1' };
	const parentEnt = ctx.createObject('set1_independant', parentObj);

	const otherObj = { name: 'ent2' };
	const otherEnt = ctx.createObject('set1_independant', parentObj);

	const childObj = { parentId: parentEnt.toRelationalKey(), name: 'ent3' };
	const childEnt = ctx.createObject('set3_dependsOn_set1', childObj);

	await new Promise(resolve => setTimeout(resolve, 100));

	expect(eventCount).toBe(1);
});


test('adding the same entity twice and then adding the parent entity does not cause any problem when creating the corresponding relationships', () => {

	const ctx = createContext();

	const childObj = { id: 2, parentId: 1, name: 'ent2' };
	const childEntT1 = ctx.trackObject('set3_dependsOn_set1', childObj);
	const childEntT2 = ctx.trackObject('set3_dependsOn_set1', childObj);

	expect(childEntT1).toBe(childEntT2);

	const orphans = ctx.getOrphanEntities();
	expect(orphans).toHaveLength(1);
	expect(orphans[0]).toMatchObject(childEntT1);

	const parentObj = { id: 1, name: 'ent1' };
	const parentEnt = ctx.trackObject('set1_independant', parentObj);

	const state = ctx.getState();

	const parentUid = state.map[childEntT1.localUid].parentsMap['set1_independant'];
	expect(parentUid).toBe(parentEnt.localUid);

	const orphans2 = ctx.getOrphanEntities();
	expect(orphans2).toHaveLength(0);
});