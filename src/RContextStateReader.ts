import { RContext, EntityKeysRecord } from './RContext';
import { IEnt, IRemoteContextState } from './RContextStateBuilder';
import { buildObjectKey } from './utils';
import type { EntitySet } from './EntitySet';

/**
 * Clase que facilita el manejo del estado de rcontext, para obtener entidades
 * y sus relaciones de manera sencilla.
 */
export class RContextStateReader {

	constructor(
		public readonly context: RContext,
		public readonly state: IRemoteContextState
	) { }

	getChildren<T>(parentEnt: IEnt<any>, chSet: EntitySet<T>): IEnt<T>[] {

		const state = this.state;
		const childrenUids = parentEnt.childrenSets[chSet.name];
		if (!childrenUids) return [];
		const children = childrenUids.map((uid) => state.map[uid]);
		return children;
	}

	getParent<T>(childEnt: IEnt<any>, parentSet: EntitySet<T>): IEnt<T> | null {

		const state = this.state;
		const parentUid = childEnt.parentsMap[parentSet.name];
		if (!parentUid) return null;
		const parent = state.map[parentUid];
		return parent;
	}

	getEntities<T>(entitySet: EntitySet<T>): IEnt<T>[] {

		const state = this.state;
		const uids = state.sets[entitySet.name];
		if (!uids) return [];
		const ents = uids
			.map((uid) => state.map[uid])
			.filter((e) => e !== undefined);
		return ents;
	}

	getEntity<T = any>(uid: string): IEnt<T> | null {

		const state = this.state;
		if (!uid) return null;
		const ent = state.map[uid];
		return ent;
	}

	/**
	 * Find an entity by its key values or uid
	 * @param entitySet The entity set instance
	 * @param id It can be either the uid or the key values of the entity, if 
	 * the entity has only one key, it can be a string or a number. If the 
	 * entity has multiple keys, it must be an object with the key values pairs
	 * @returns The entity if found, otherwise null
	 */
	findEntity<T>(entitySet: EntitySet<T>, id: string | number | EntityKeysRecord): IEnt<T> | null {

		const state = this.state;
		const setDef = this.context.getSetDefinition(entitySet.name);
		if (setDef.keys.length === 0) return null;

		if (typeof id === 'string') {
			const isUid = id in state.map;
			if (isUid) return state.map[id];
		}
		else if (typeof id === 'object') {
			const key = buildObjectKey(id, setDef.keys);
			if (key === null) return null;
			id = key;
		}

		const set = state.sets[entitySet.name];
		if (!set) return null;

		for (const uid of set) {
			const iEnt = state.map[uid];			
			const iEntKey = buildObjectKey(iEnt.data, setDef.keys);

			if (iEntKey !== id) continue;

			return iEnt;
		}

		return null;
	}
}
