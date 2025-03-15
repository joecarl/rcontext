import { IEnt, IRemoteContextState } from './RemoteContextStateManager';

/**
 * Clase que facilita el manejo del estado de rcontext, para obtener entidades
 * y sus relaciones de manera sencilla.
 */
export class RContextStateHelper {
	
	constructor(public readonly state: IRemoteContextState) { }

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
}
