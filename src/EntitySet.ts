import type { IParentKey, RContext } from './RContext';
import { EntitySetIndexer } from './EntitySetIndexer';
import { EntityObject } from './EntityObject';

export class EntitySet<T> {

	private readonly _parentKeys: IParentKey<any, T>[] = [];

	private readonly _objects: Record<string, EntityObject<T>> = {};

	private readonly _indexer: EntitySetIndexer<T>;

	constructor(
		private readonly ctx: RContext,
		public readonly name: string,
		public readonly keys: string[],
		parentKeys: IParentKey<any, T>[] = [],
	) {
		this._parentKeys.push(...parentKeys);
		this._indexer = new EntitySetIndexer<T>(keys);
	}

	get parentKeys(): ReadonlyArray<IParentKey<any, T>> {
		return this._parentKeys;
	}

	/**
	 * Adds a parent key definition to this entity set.
	 * Useful for self-referential sets, where the parent key can't be defined at creation time.
	 */
	addParentKey(pk: IParentKey<any, T>): void {
		this._parentKeys.push(pk);
	}

	/** @internal Re-computes the index entry for an entity whose data may have changed. */
	reindexObject(ent: EntityObject<T>): void {
		this._indexer.reindex(ent);
	}

	/**
	 * Finds an entity in this set whose keys match the provided values.
	 */
	findEntity(keyValues: Record<string, any>): EntityObject<T> | null {
		return this._indexer.findByKeyValues(keyValues);
	}

	/** @internal O(1) lookup by pre-built key string (output of buildObjectKey.toString()). */
	findEntityByKeyString(keyStr: string): EntityObject<T> | null {
		return this._indexer.findByKeyString(keyStr);
	}

	/**
	 * Creates a new entity in this set with local-only data (action: 'create')
	 */
	createObject(obj: Partial<T>): EntityObject<T> {
		const ent = new EntityObject<T>(this.ctx, this.name, 'create', null, obj);
		this._objects[ent.cid] = ent;
		this._indexer.add(ent);
		this.ctx.registerObject(ent);
		return ent;
	}

	/**
	 * Tracks an existing remote entity in this set (action: 'read').
	 * If an entity with the same keys already exists it is updated instead.
	 */
	trackObject(obj: T): EntityObject<T> {
		const existing = this.findEntity(obj as Record<string, any>);
		if (existing) {
			existing.updateRemoteData(obj);
			return existing;
		}
		const ent = new EntityObject<T>(this.ctx, this.name, 'read', obj);
		this._objects[ent.cid] = ent;
		this._indexer.add(ent);
		this.ctx.registerObject(ent);
		return ent;
	}

	trackMultipleObjects(objs: T[]): EntityObject<T>[] {
		const ents: EntityObject<T>[] = [];
		for (const obj of objs) {
			const existing = this.findEntity(obj as Record<string, any>);
			if (existing) {
				existing.updateRemoteData(obj);
				ents.push(existing);
				continue;
			}
			const ent = new EntityObject<T>(this.ctx, this.name, 'read', obj);
			this._objects[ent.cid] = ent;
			this._indexer.add(ent);
			ents.push(ent);
		}
		this.ctx.registerMultipleObjects(ents);
		return ents;
	}

	/** @internal */
	unregisterObject(uid: string): void {
		this._indexer.remove(uid);
		delete this._objects[uid];
	}
}
