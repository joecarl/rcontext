import type { EntityObject } from './EntityObject';
import { buildObjectKey } from './utils';

export class EntitySetIndexer<T> {

    private readonly _keyIndex: Map<string, EntityObject<T>> = new Map();
    private readonly _uidToKey: Map<string, string> = new Map();

    constructor(private readonly keys: string[]) {}

    private computeKey(data: Record<string, any>): string | null {
        if (this.keys.length === 0) return null;
        try {
            const k = buildObjectKey(data as T, this.keys as (keyof T & string)[]);
            return k === null ? null : k.toString();
        } catch {
            return null;
        }
    }

    add(ent: EntityObject<T>): void {
        const key = this.computeKey(ent.getData() as Record<string, any>);
        if (key === null) return;
        this._keyIndex.set(key, ent);
        this._uidToKey.set(ent.cid, key);
    }

    remove(uid: string): void {
        const key = this._uidToKey.get(uid);
        if (key === undefined) return;
        this._keyIndex.delete(key);
        this._uidToKey.delete(uid);
    }

    reindex(ent: EntityObject<T>): void {
        this.remove(ent.cid);
        this.add(ent);
    }

    findByKeyValues(keyValues: Record<string, any>): EntityObject<T> | null {
        const key = this.computeKey(keyValues);
        if (key === null) return null;
        return this._keyIndex.get(key) ?? null;
    }

    findByKeyString(keyStr: string): EntityObject<T> | null {
        return this._keyIndex.get(keyStr) ?? null;
    }
}