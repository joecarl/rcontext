import type { TAction, IParentKey, RemoteContext, TSets } from './RemoteContext';
import type { RemoteEntityObject } from './RemoteEntityObject';

export interface IRemoteContextState {
	sets: TSets;
	map: Record<string, IEnt<any>>;
}

export interface IEnt<T> {
	entity: RemoteEntityObject<T>;
	action: TAction;
	data: T;
	childrenSets: TSets;
	parentsMap: Record<string, string>;
}


export type TStateChangeType = 'add' | 'remove' | 'update';


export class RemoteContextStateManager {

	private orphanEntities: RemoteEntityObject<any>[] = [];

	private contextState: IRemoteContextState;

	constructor(private readonly ctx: RemoteContext) {

		this.contextState = {
			sets: {},
			map: {},
		};
	}

	private getUpdatedParentKeys(newState: IRemoteContextState, ent: RemoteEntityObject<any>) {

		const setName = ent.entitySet;
		const setDef = this.ctx.getSetDefinition(setName);
		const currProps = newState.map[ent.localUid].data;
		const oldProps = this.contextState.map[ent.localUid].data;
		const updatedParentKeys = setDef.parentKeys.filter(pKey => currProps[pKey.prop] !== oldProps[pKey.prop]);

		return updatedParentKeys;
	}

	private removeFromChildrenSet(newState: IRemoteContextState, ent: RemoteEntityObject<any>, parentKey: IParentKey) {

		const setName = ent.entitySet;
		const entUid = ent.localUid;
		const oldData = this.contextState.map[entUid].data;
		const pKeyValue = oldData[parentKey.prop];
		if (pKeyValue === undefined) {
			throw new Error('Relational key "' + parentKey.prop + '" is not defined');
		}
		if (pKeyValue === null) {
			return true;
		}
		const pSetName = parentKey.entitySet;
		const parentUid = this.ctx.findEntityUid(pSetName, pKeyValue);
		if (!parentUid) {
			console.warn('Parent not found', pSetName, pKeyValue);
			//success = false;
			return false;
		}
		const iParentEnt = newState.map[parentUid];
		const childrenSet = iParentEnt.childrenSets[setName] ?? [];

		const chIdx = childrenSet.indexOf(entUid);
		if (chIdx === -1) return true;

		const newChildrenSet = [...childrenSet];
		newChildrenSet.splice(chIdx, 1);

		newState.map[parentUid] = {
			...iParentEnt,
			childrenSets: {
				...iParentEnt.childrenSets,
				[setName]: newChildrenSet
			}
		};

		// TODO: Revisar que esto funcione
		const iEnt = newState.map[ent.localUid];
		if (iEnt) { // en caso de que se haya llamado a esta funcion por un 'delete' no tenemos que preocuparnos de actualizar iEnt ya que se habra eliminado
			newState.map[ent.localUid] = {
				...iEnt,
				parentsMap: {
					...iEnt.parentsMap,
					[pSetName]: undefined,
				}
			}
		}

		return true;
	}

	private addToChildrenSet(newState: IRemoteContextState, ent: RemoteEntityObject<any>, parentKey: IParentKey) {

		const setName = ent.entitySet;
		const pKeyValue = ent.getData()[parentKey.prop];
		if (pKeyValue === undefined) {
			throw new Error('Relational key "' + parentKey.prop + '" is not defined');
		}
		if (pKeyValue === null) {
			return true;
		}
		const pSetName = parentKey.entitySet;
		const parentUid = this.ctx.findEntityUid(pSetName, pKeyValue);
		if (!parentUid) {
			//console.warn('Parent not found', pSetName, pKeyValue);
			//success = false;
			return false;
		}
		const iParentEnt = newState.map[parentUid];
		const childrenSet = iParentEnt.childrenSets[setName] ?? [];

		if (childrenSet.indexOf(ent.localUid) !== -1) return true;

		newState.map[parentUid] = {
			...iParentEnt,
			childrenSets: {
				...iParentEnt.childrenSets,
				[setName]: [
					...childrenSet,
					ent.localUid
				]
			}
		};

		// TODO: Revisar que esto funcione
		const iEnt = newState.map[ent.localUid];
		newState.map[ent.localUid] = {
			...iEnt,
			parentsMap: {
				...iEnt.parentsMap,
				[pSetName]: parentUid,
			}
		}

		return true;
	}

	/**
	 * Finds the parent elements of the provided entity in the given state and then updates their corresponding childrenSets
	 */
	private updateStateHierarchy(newState: IRemoteContextState, ent: RemoteEntityObject<any>, changeType: TStateChangeType) {

		const setName = ent.entitySet;
		const setDef = this.ctx.getSetDefinition(setName);
		let success = true;

		const parentKeys = changeType === 'update' ? this.getUpdatedParentKeys(newState, ent) : setDef.parentKeys;

		for (const parentKey of parentKeys) {

			if (changeType === 'remove' || changeType === 'update') {
				this.removeFromChildrenSet(newState, ent, parentKey);
			}
			if (changeType === 'add' || changeType === 'update') {
				const result = this.addToChildrenSet(newState, ent, parentKey);
				if (!result) success = false;
			}
		}

		const idx = this.orphanEntities.indexOf(ent);
		if (success) {
			if (idx !== -1) this.orphanEntities.splice(idx, 1);
		} else {
			if (idx === -1) this.orphanEntities.push(ent);
		}
	}


	emitChange(changeType: TStateChangeType, affectedUids: string[]) {

		const newState = { ...this.contextState };
		newState.sets = { ...newState.sets };
		newState.map = { ...newState.map };

		for (const uid of affectedUids) {

			const ent = this.ctx.getObject(uid);
			const entitySet = ent.entitySet;

			if (changeType === 'add') {

				if (newState.sets[entitySet] === undefined) {
					newState.sets[entitySet] = [];
				}
				newState.sets[entitySet].push(uid);
				newState.map[uid] = RemoteContextStateManager.buildEntityState(ent);

			} else if (changeType === 'remove') {

				newState.sets[entitySet] = newState.sets[entitySet].filter(u => u !== uid);
				delete newState.map[uid];

			} else if (changeType === 'update') {

				newState.map[uid] = {
					...RemoteContextStateManager.buildEntityState(ent),
					childrenSets: newState.map[uid].childrenSets,
					parentsMap: newState.map[uid].parentsMap,
				};
			}

			this.updateStateHierarchy(newState, ent, changeType);
			[...this.orphanEntities].forEach(orphanEnt => {
				this.updateStateHierarchy(newState, orphanEnt, changeType);
			});
			//console.log('huerfanos', this.orphanEntities);
		}

		this.contextState = newState;
		return this.contextState;
	}


	getState() {

		return this.contextState;
	}


	private static buildEntityState(ent: RemoteEntityObject<any>): IEnt<any> {

		return {
			action: ent.getAction(),
			childrenSets: {},
			parentsMap: {},
			data: ent.getData(),
			entity: ent,
		};
	}
}
