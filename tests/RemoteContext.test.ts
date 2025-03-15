import { test, expect } from 'vitest';
import { RemoteContext } from '../src/RemoteContext';
import { RemoteEntityObject } from '../src/RemoteEntityObject';

function createContext() {
	const ctx = new RemoteContext();

	ctx.addEntitySet({
		name: 'entitySet1',
		keys: ['id'],
		parentKeys: []
	});

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

	return ctx;
}


test('adding related objects creates relationships in state', () => {

	const ctx = createContext();

	const obj1 = { id: 1, name: 'ent1' };
	const obj2 = { id: 2, parentId: 1, name: 'ent2' };

	const ent2 = ctx.trackObject('entitySet2', obj2);
	const ent1 = ctx.trackObject('entitySet1', obj1);

	const state = ctx.getState();

	const chSet = state.map[ent1.localUid].childrenSets.entitySet2;
	expect(chSet).toBeTruthy();

	const chUid = chSet[0];
	expect(chUid).toBe(ent2.localUid);
	const ch = state.map[chUid];
	expect(ch).toBeTruthy();
	expect(ch.data).toMatchObject({ ...obj2 });

	const parentUid = state.map[ent2.localUid].parentsMap.entitySet1;
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

	const parentUid = state.map[ent2.localUid].parentsMap.entitySet1;
	expect(parentUid).toBeFalsy();
});

test('adding related objects with missing parent does not create relationships in state', () => {

	const ctx = createContext();

	const obj2 = { id: 2, parentId: 1, name: 'ent2' };

	const ent2 = ctx.trackObject('entitySet2', obj2);

	const state = ctx.getState();

	const parentUid = state.map[ent2.localUid].parentsMap.entitySet1;
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

	const chSet = state.map[ent1.localUid].childrenSets.entitySet2;
	expect(chSet).toBeTruthy();

	const chUid = chSet[0];
	expect(chUid).toBe(ent2.localUid);
	const ch = state.map[chUid];
	expect(ch).toBeTruthy();
	expect(ch.data).toMatchObject({ ...obj2 });

	const parentUid = state.map[ent2.localUid].parentsMap.entitySet1;
	expect(parentUid).toBe(ent1.localUid);
	const parent = state.map[parentUid];
	expect(parent).toBeTruthy();
	expect(parent.data).toMatchObject({ ...obj1 });
});
