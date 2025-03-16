import type { TAction, IParentKey, RContext, TSets, IObjectResult } from './RContext';
import type { RemoteEntityObject } from './RemoteEntityObject';
import { getParentKey } from './utils';

/**
 * Represents the state of the context
 */
export interface IRemoteContextState {
	readonly sets: TSets;
	readonly map: Record<string, IEnt<any>>;
}

/**
 * Represents the state of a single entity in the context
 */
export interface IEntityState<T> {
	readonly uid: string;
	readonly entity: RemoteEntityObject<T>;
	readonly action: TAction;
	readonly data: T;
	readonly childrenSets: TSets;
	readonly parentsMap: Record<string, string>;
	readonly syncResult: IObjectResult<T> | null;
}

/**
 * Alias to keep retrocompatibility with the previous version of the library
 */
export type IEnt<T> = IEntityState<T>;

/**
 * Represents the type of change that must be applied to the state
 */
export type TStateChangeType = 'add' | 'remove' | 'update';


export class RContextStateBuilder {

	/**
	 * List of entities with defined parent keys which point to non-existent parent entities
	 */
	private orphanEntities: RemoteEntityObject<any>[] = [];

	/**
	 * The current state of the context
	 */
	private contextState: IRemoteContextState;


	constructor(private readonly ctx: RContext) {

		this.contextState = {
			sets: {},
			map: {},
		};
	}

	/**
	 * Returns the updated parent keys definitions of the provided entity. It compares the parent keys of the old state with the new state
	 * @param newState The new state
	 * @param ent The entity that was updated
	 * @returns The updated parent keys definitions
	 */
	private getUpdatedParentKeys(newState: IRemoteContextState, ent: RemoteEntityObject<any>) {

		const setName = ent.entitySet;
		const setDef = this.ctx.getSetDefinition(setName);
		const currProps = newState.map[ent.localUid].data;
		const oldProps = this.contextState.map[ent.localUid].data;
		const updatedParentKeys = setDef.parentKeys.filter(pKey => getParentKey(currProps, pKey) !== getParentKey(oldProps, pKey));

		return updatedParentKeys;
	}

	/**
	 * Updates the childrenSets of the parent entities of the provided entity
	 * @param newState The state to update
	 * @param ent The removed entity
	 * @param parentKey 
	 * @returns True if the operation was successful, false otherwise
	 */
	private removeFromChildrenSet(newState: IRemoteContextState, ent: RemoteEntityObject<any>, parentKey: IParentKey) {

		const setName = ent.entitySet;
		const entUid = ent.localUid;
		const oldData = this.contextState.map[entUid].data;
		const pKeyValue = getParentKey(oldData, parentKey);

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

		// Also update the parentsMap of the entity
		const iEnt = newState.map[ent.localUid];
		if (iEnt) {
			newState.map[ent.localUid] = {
				...iEnt,
				parentsMap: {
					...iEnt.parentsMap,
					[pSetName]: undefined,
				}
			};
		}
		// else: in case of a 'delete' operation, the entity has already been removed from the state so we don't need to update it

		return true;
	}

	/**
	 * Updates the childrenSets of the parent entities of the provided entity
	 * @param newState The state to update
	 * @param ent The added entity
	 * @param parentKey 
	 * @returns True if the operation was successful, false otherwise
	 */
	private addToChildrenSet(newState: IRemoteContextState, ent: RemoteEntityObject<any>, parentKey: IParentKey) {

		const setName = ent.entitySet;
		const pKeyValue = getParentKey(ent.getData(), parentKey);

		if (pKeyValue === null) {
			return true;
		}
		const pSetName = parentKey.entitySet;
		const parentUid = this.ctx.findEntityUid(pSetName, pKeyValue);
		if (!parentUid) {
			return false;
		}
		const iParentEnt = newState.map[parentUid];
		if (!iParentEnt) {
			return false;
		}
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

		// Also update the parentsMap of the entity
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
	 * @param newState The state to update
	 * @param ent The entity which was added, removed or updated
	 * @param changeType The type of change that was applied
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

		if (changeType === 'remove') {

			const iEnt = this.contextState.map[ent.localUid];
			for (const entitySet in iEnt.childrenSets) {
				const childrenSet = iEnt.childrenSets[entitySet];
				for (const childUid of childrenSet) {
					const childEnt = newState.map[childUid];
					const newParentsMap = { ...childEnt.parentsMap };
					delete newParentsMap[setName];
					newState.map[childUid] = {
						...childEnt,
						parentsMap: newParentsMap
					}

					const idx = this.orphanEntities.indexOf(childEnt.entity);
					if (idx === -1) this.orphanEntities.push(childEnt.entity);
				}
			}
		}
	}

	/**
	 * Emits a state change which updates the state of the context
	 * @param changeType The type of change that was applied
	 * @param affectedUids The uids of the entities that changed. This function will update the state of these entities and their parent/child entities if necessary
	 * @returns The updated state
	 */
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
				newState.map[uid] = RContextStateBuilder.buildEntityState(ent);

			} else if (changeType === 'remove') {

				newState.sets[entitySet] = newState.sets[entitySet].filter(u => u !== uid);
				delete newState.map[uid];

			} else if (changeType === 'update') {

				newState.map[uid] = {
					...RContextStateBuilder.buildEntityState(ent),
					childrenSets: newState.map[uid].childrenSets,
					parentsMap: newState.map[uid].parentsMap,
				};
			}

			this.updateStateHierarchy(newState, ent, changeType);
			[...this.orphanEntities].forEach(orphanEnt => {
				this.updateStateHierarchy(newState, orphanEnt, 'add');
			});
		}

		this.contextState = newState;
		return this.contextState;
	}


	getState(): Readonly<IRemoteContextState> {

		return this.contextState;
	}

	getOrphanEntities() {

		return this.orphanEntities;
	}


	private static buildEntityState(ent: RemoteEntityObject<any>): IEnt<any> {

		return {
			uid: ent.localUid,
			action: ent.getAction(),
			childrenSets: {},
			parentsMap: {},
			data: ent.getData(),
			entity: ent,
			syncResult: ent.getSyncResult(),
		};
	}
}
