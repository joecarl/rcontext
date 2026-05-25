import { test, expect } from 'vitest';
import { RContext } from '../src/RContext';
import { RemoteEntityObject } from '../src/RemoteEntityObject';
import { createContext } from './testContext';
import { RContextStateReader } from '../src/RContextStateReader';


test('findEntity accepts the key either as value or as a key-value object when the entity has a single key', () => {

	const { ctx, set1 } = createContext();

	const obj1 = { id: 26, name: 'ent1' };
	const ent1 = set1.trackObject(obj1);

	const obj2 = { id: 14, name: 'ent2' };
	const ent2 = set1.trackObject(obj2);

	const state = ctx.getState();
	const reader = ctx.createStateReader(state);

	const res1 = reader.findEntity(set1, { id: 26 });
	const res2 = reader.findEntity(set1, 26);

	expect(res1).toBeTruthy();
	expect(res2).toBeTruthy();
	expect(res1).toEqual(res2);
	expect(res1?.data).toMatchObject(obj1);
});


test('findEntity finds the entity by its uid', () => {

	const { ctx, set1 } = createContext();

	const obj1 = { id: 26, name: 'ent1' };
	const ent1 = set1.trackObject(obj1);

	const obj2 = { id: 14, name: 'ent2' };
	const ent2 = set1.trackObject(obj2);

	const obj3 = { id: 42, name: 'ent3' };
	const ent3 = set1.trackObject(obj3);

	const state = ctx.getState();
	const reader = ctx.createStateReader(state);

	const res1 = reader.findEntity(set1, ent2.localUid);

	expect(res1).toBeTruthy();
	expect(res1?.data).toMatchObject(obj2);
});


test('findEntity finds a multikey entity', () => {

	const { ctx, set6 } = createContext();

	const obj1 = { firstKey: 26, secondKey: 'PHL', name: 'ent1' };
	const ent1 = set6.trackObject(obj1);

	const obj2 = { firstKey: 89, secondKey: 'RKG', name: 'ent2' };
	const ent2 = set6.trackObject(obj2);

	const state = ctx.getState();
	const reader = ctx.createStateReader(state);

	const res1 = reader.findEntity(set6, { firstKey: 26, secondKey: 'PHL' });

	expect(res1).toBeTruthy();
	expect(res1?.data).toMatchObject(obj1);
});


test('getEntities returns the entities in the specified set', () => {

	const { ctx, set1 } = createContext();

	const obj1 = { id: 26, name: 'ent1' };
	const ent1 = set1.trackObject(obj1);

	const obj2 = { id: 14, name: 'ent2' };
	const ent2 = set1.trackObject(obj2);

	const obj3 = { id: 42, name: 'ent3' };
	const ent3 = set1.trackObject(obj3);

	const state = ctx.getState();
	const reader = ctx.createStateReader(state);

	const res = reader.getEntities(set1);

	expect(res).toBeTruthy();
	expect(res.length).toBe(3);
	expect(res[0].data).toMatchObject(obj1);
	expect(res[1].data).toMatchObject(obj2);
	expect(res[2].data).toMatchObject(obj3);
});

test('findEntity doest not crash when finding a new object', async () => {

	const { ctx, set1 } = createContext();
	ctx.onContextChange = (state) => {};

	const obj1 = { id: 26, name: 'ent1' };
	const ent1 = set1.trackObject(obj1);

	const obj2 = { id: 89, name: 'ent2' };
	const readerOld = ctx.createStateReader(ctx.getState());
	const ent2 = set1.trackObject(obj2);

	const reader = await new Promise<RContextStateReader>((resolve) => {
		ctx.onContextChange = (state) => {
			const reader = ctx.createStateReader(state);
			resolve(reader);
		};
	});

	const res = readerOld.findEntity(set1, 89);

	expect(res).toBeNull();
});