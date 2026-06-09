import { test, expect } from 'vitest';
import { createContext } from './testContext';


test('indexer: trackObject makes entity findable by key', () => {

	const { set1 } = createContext();

	const ent = set1.trackObject({ id: 42, name: 'foo' });

	expect(set1.findEntity({ id: 42 })).toBe(ent);
});

test('indexer: trackMultipleObjects makes all entities findable by key', () => {

	const { set1 } = createContext();

	const ents = set1.trackMultipleObjects([
		{ id: 1, name: 'a' },
		{ id: 2, name: 'b' },
		{ id: 3, name: 'c' },
	]);

	expect(set1.findEntity({ id: 1 })).toBe(ents[0]);
	expect(set1.findEntity({ id: 2 })).toBe(ents[1]);
	expect(set1.findEntity({ id: 3 })).toBe(ents[2]);
});

test('indexer: after removeImmediately the entity is no longer findable', () => {

	const { set1 } = createContext();

	const ent = set1.trackObject({ id: 7, name: 'foo' });
	ent.removeImmediately();

	expect(set1.findEntity({ id: 7 })).toBeNull();
});

test('indexer: after editing a key field the entity is findable by the new key and not the old one', () => {

	const { set1 } = createContext();

	const ent = set1.trackObject({ id: 10, name: 'foo' });
	ent.edit({ id: 99 } as any);

	expect(set1.findEntity({ id: 99 })).toBe(ent);
	expect(set1.findEntity({ id: 10 })).toBeNull();
});

test('indexer: after sync with server-assigned id the entity is findable by the new id', () => {

	const { ctx, set1 } = createContext();

	const ent = set1.createObject({ name: 'new entity' });

	ctx.sync({
		[ent.cid]: {
			success: true,
			message: '',
			feedback: null,
			data: { id: 55, name: 'new entity' },
		},
	});

	expect(set1.findEntity({ id: 55 })).toBe(ent);
});

test('indexer: trackObject with same key twice returns the same entity and keeps it indexed', () => {

	const { set1 } = createContext();

	const ent1 = set1.trackObject({ id: 5, name: 'first' });
	const ent2 = set1.trackObject({ id: 5, name: 'updated' });

	expect(ent1).toBe(ent2);
	expect(set1.findEntity({ id: 5 })).toBe(ent1);
});

test('indexer: multikey entity is findable by combined key', () => {

	const { set6 } = createContext();

	const ent = set6.trackObject({ firstKey: 1, secondKey: 'a', name: 'foo' });

	expect(set6.findEntity({ firstKey: 1, secondKey: 'a' })).toBe(ent);
	expect(set6.findEntity({ firstKey: 1, secondKey: 'b' })).toBeNull();
});

test('indexer: editing parent key resolves pending orphan', () => {

	const { set1, set3 } = createContext();

	// Orphan child expects parentId: 99
	const child = set3.trackObject({ id: 1, parentId: 99, name: 'child' });

	// Parent tracked with id: 10, child is still orphan
	const parent = set1.trackObject({ id: 10, name: 'parent' });

	// Edit the parent key to match what the child expects
	parent.edit({ id: 99 } as any);

	// Now the index has key 99 → parent, so the orphan should resolve
	const state = set1['ctx'].getState();
	const parentUid = state.map[child.cid]?.parentsMap['set1_independant'];
	expect(parentUid).toBe(parent.cid);
});
