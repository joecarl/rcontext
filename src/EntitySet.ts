import type { IParentKey, RContext } from './RContext';
import { RemoteEntityObject } from './RemoteEntityObject';

export class EntitySet<T> {

	private readonly _parentKeys: IParentKey<any, T>[] = [];

	private readonly _objects: Record<string, RemoteEntityObject<T>> = {};

	constructor(
		private readonly ctx: RContext,
		public readonly name: string,
		public readonly keys: string[],
		parentKeys: IParentKey<any, T>[] = [],
	) {
		this._parentKeys.push(...parentKeys);
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

	/**
	 * Finds an entity in this set whose keys match the provided values.
	 */
	findEntity(keyValues: Record<string, any>): RemoteEntityObject<T> | null {
		if (this.keys.length === 0) return null;
		for (const uid in this._objects) {
			const ent = this._objects[uid];
			const data = ent.getData();
			if (this.keys.every(k => keyValues[k] === (data as Record<string, any>)[k])) return ent;
		}
		return null;
	}

	/**
	 * Creates a new entity in this set with local-only data (action: 'create')
	 */
	createObject(obj: Partial<T>): RemoteEntityObject<T> {
		const ent = new RemoteEntityObject<T>(this.ctx, this.name, 'create', null, obj);
		this._objects[ent.localUid] = ent;
		this.ctx.registerObject(ent);
		return ent;
	}

	/**
	 * Tracks an existing remote entity in this set (action: 'read').
	 * If an entity with the same keys already exists it is updated instead.
	 */
	trackObject(obj: T): RemoteEntityObject<T> {
		const existing = this.findEntity(obj as Record<string, any>);
		if (existing) {
			existing.updateRemoteData(obj);
			return existing;
		}
		const ent = new RemoteEntityObject<T>(this.ctx, this.name, 'read', obj);
		this._objects[ent.localUid] = ent;
		this.ctx.registerObject(ent);
		return ent;
	}

	/** @internal */
	unregisterObject(uid: string): void {
		delete this._objects[uid];
	}
}
