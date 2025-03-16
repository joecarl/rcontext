import { RContext, TKeysRecord } from './RContext';
import { IEnt, IRemoteContextState } from './RContextStateBuilder';
import { buildObjectKey } from './utils';

/**
 * Clase que facilita el manejo del estado de rcontext, para obtener entidades
 * y sus relaciones de manera sencilla.
 */
export class RContextStateReader {

	constructor(
		public readonly context: RContext,
		public readonly state: IRemoteContextState
	) { }

	getChildren<T = any>(parentEnt: IEnt<any>, chSet: string): IEnt<T>[] {

		const state = this.state;
		const childrenUids = parentEnt.childrenSets[chSet];
		if (!childrenUids) return [];
		const children = childrenUids.map((uid) => state.map[uid] as IEnt<T>);
		return children;
	}

	getParent<T = any>(childEnt: IEnt<any>, parentSet: string): IEnt<T> | null {

		const state = this.state;
		const parentUid = childEnt.parentsMap[parentSet];
		if (!parentUid) return null;
		const parent = state.map[parentUid] as IEnt<T>;
		return parent;
	}

	getEntities<T = any>(setName: string): IEnt<T>[] {

		const state = this.state;
		const uids = state.sets[setName];
		if (!uids) return [];
		const ents = uids
			.map((uid) => state.map[uid] as IEnt<T>)
			.filter((e) => e !== undefined);
		return ents;
	}

	getEntity<T = any>(uid: string): IEnt<T> | null {

		const state = this.state;
		if (!uid) return null;
		const ent = state.map[uid] as IEnt<T>;
		return ent;
	}

	/**
	 * Find an entity by its key values or uid
	 * @param setName The entity set name
	 * @param id It can be either the uid or the key values of the entity, if 
	 * the entity has only one key, it can be a string or a number. If the 
	 * entity has multiple keys, it must be an object with the key values pairs
	 * @returns The entity if found, otherwise null
	 */
	findEntity<T = any>(setName: string, id: string | number | TKeysRecord) {

		const state = this.state;
		const setDef = this.context.getSetDefinition(setName);
		if (setDef.keys.length === 0) return null;

		if (typeof id === 'string') {
			const isUid = id in state.map;
			if (isUid) return state.map[id] as IEnt<T>;
		}
		else if (typeof id === 'object') {
			id = buildObjectKey(id, setDef.keys);
		}

		const set = state.sets[setName];
		if (!set) return null;

		for (const uid of set) {
			const iEnt = state.map[uid];
			const iEntKey = buildObjectKey(iEnt.data, setDef.keys);

			if (iEntKey !== id) continue;

			return iEnt as IEnt<T>;
		}

		return null;
	}
}
