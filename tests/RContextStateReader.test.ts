import { test, expect } from 'vitest';
import { RContext } from '../src/RContext';
import { RemoteEntityObject } from '../src/RemoteEntityObject';
import { createContext } from './testContext';


test('findEntity accepts the key either as value or as a key-value object when the entity has a single key', () => {

    const ctx = createContext();

    const obj1 = { id: 26, name: 'ent1' };
    const ent1 = ctx.trackObject('set1_independant', obj1);

    const obj2 = { id: 14, name: 'ent2' };
    const ent2 = ctx.trackObject('set1_independant', obj2);

    const state = ctx.getState();
    const reader = ctx.createStateReader(state);

    const res1 = reader.findEntity('set1_independant', { id: 26 });
    const res2 = reader.findEntity('set1_independant', 26);

    expect(res1).toBeTruthy();
    expect(res2).toBeTruthy();
    expect(res1).toEqual(res2);
    expect(res1?.data).toMatchObject(obj1);
});


test('findEntity finds the entity by its uid', () => {

    const ctx = createContext();

    const obj1 = { id: 26, name: 'ent1' };
    const ent1 = ctx.trackObject('set1_independant', obj1);

    const obj2 = { id: 14, name: 'ent2' };
    const ent2 = ctx.trackObject('set1_independant', obj2);

    const obj3 = { id: 42, name: 'ent3' };
    const ent3 = ctx.trackObject('set1_independant', obj3);

    const state = ctx.getState();
    const reader = ctx.createStateReader(state);

    const res1 = reader.findEntity('set1_independant', ent2.localUid);

    expect(res1).toBeTruthy();
    expect(res1?.data).toMatchObject(obj2);
});


test('findEntity finds a multikey entity', () => {

    const ctx = createContext();

    const obj1 = { firstKey: 26, secondKey: 'PHL', name: 'ent1' };
    const ent1 = ctx.trackObject('set6_multikey', obj1);

    const obj2 = { firstKey: 89, secondKey: 'RKG', name: 'ent2' };
    const ent2 = ctx.trackObject('set6_multikey', obj2);

    const state = ctx.getState();
    const reader = ctx.createStateReader(state);

    const res1 = reader.findEntity('set6_multikey', { firstKey: 26, secondKey: 'PHL' });

    expect(res1).toBeTruthy();
    expect(res1?.data).toMatchObject(obj1);
});


test('getEntities returns the entities in the specified set', () => {
    
    const ctx = createContext();

    const obj1 = { id: 26, name: 'ent1' };
    const ent1 = ctx.trackObject('set1_independant', obj1);

    const obj2 = { id: 14, name: 'ent2' };
    const ent2 = ctx.trackObject('set1_independant', obj2);

    const obj3 = { id: 42, name: 'ent3' };
    const ent3 = ctx.trackObject('set1_independant', obj3);

    const state = ctx.getState();
    const reader = ctx.createStateReader(state);

    const res = reader.getEntities('set1_independant');

    expect(res).toBeTruthy();
    expect(res.length).toBe(3);
    expect(res[0].data).toMatchObject(obj1);
    expect(res[1].data).toMatchObject(obj2);
    expect(res[2].data).toMatchObject(obj3);
});