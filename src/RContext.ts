import type { IRemoteContextState, StateChangeType } from './RContextStateBuilder';
import { RemoteEntityObject } from './RemoteEntityObject';
import { RContextStateBuilder } from './RContextStateBuilder';
import { buildObjectKey } from './utils';
import { RContextStateReader } from './RContextStateReader';
import { EntitySet } from './EntitySet';

export type EntitySets = Record<string, string[]>;

export type EntityAction = 'create' | 'read' | 'update' | 'delete';

export type EntityKeysRecord = Record<string, string | number>;

export interface IObjectResult<T = any> {
	success: boolean;
	message: string;
	data: T | null;
	feedback: Record<keyof T, string> | null;
}

export interface IObjectRequest<T = any> {
	entitySet: string;
	remoteUid: string;
	action: EntityAction;
	newData: T;
	keys: EntityKeysRecord | null;
}

export interface IParentKey<TParent = any, TChild = any> {
	/**
	 * The order must be the same as the order of keys specified in the parent entitySet
	 */
	props: (keyof TChild & string)[];

	/**
	 * The parent entitySet instance
	 */
	entitySet: EntitySet<TParent>;
}


export class RContext {

	private static readonly uidPrefix = '~uid~';

	private readonly stateManager: RContextStateBuilder;

	private uidIndex: number = 1;

	private setNameIndex: number = 0;

	private objects: Record<string, RemoteEntityObject<any>> = {};

	private setsDefinitions: Record<string, EntitySet<any>> = {};

	private triggerStateChangeTimeout: any;

	private pendingState: IRemoteContextState | null = null;

	public onContextChange: (newState: IRemoteContextState) => void = () => { };


	constructor() {

		this.stateManager = new RContextStateBuilder(this);
	}

	addEntitySet<T = any>(def: {
		name?: string;
		keys: (keyof T & string)[];
		parentKeys?: IParentKey<any, T>[];
	}): EntitySet<T> {

		const name = def.name ?? `EntitySet_${++this.setNameIndex}`;
		const set = new EntitySet<T>(
			this,
			name,
			def.keys as string[],
			(def.parentKeys ?? []) ,
		);
		this.setsDefinitions[name] = set;
		return set;
	}

	/** @internal */
	registerObject(ent: RemoteEntityObject<any>) {

		this.objects[ent.localUid] = ent;
		this.emitStateChange('add', [ent.localUid]);
	}

	/** @internal */
	registerMultipleObjects(ents: RemoteEntityObject<any>[]) {

		for (const ent of ents) {
			this.objects[ent.localUid] = ent;
		}
		this.emitStateChange('add', ents.map(ent => ent.localUid));
	}

	/** @internal */
	getObject(uid: string) {
		return this.objects[uid];
	}

	/** @internal */
	getSetDefinition(setName: string): EntitySet<any> {
		return this.setsDefinitions[setName];
	}

	/** @internal */
	getNewUid() {

		return RContext.uidPrefix + (this.uidIndex++);
	}

	/**
	 * @internal
	 * Tells the state manager to emit a state change
	 * @param changeType 'add' if the objects must be added, 'update' if the objects must be updated, 'remove' if the objects must be removed
	 * @param affectedUids the uids of the objects that are affected by the change
	 */
	emitStateChange(changeType: StateChangeType, affectedUids: string[]) {

		if (changeType === 'update') {
			for (const uid of affectedUids) {
				const ent = this.objects[uid];
				if (ent) this.setsDefinitions[ent.entitySetName]?.reindexObject(ent);
			}
		}

		const newState = this.stateManager.emitChange(changeType, affectedUids);

		if (typeof this.onContextChange !== 'function') return;

		this.pendingState = newState;
		clearTimeout(this.triggerStateChangeTimeout);
		this.triggerStateChangeTimeout = setTimeout(() => {
			this.triggerOnContextChange();
		}, 1);
	}

	/**
	 * Immediately fires the pending debounced `onContextChange` notification, if any.
	 * Useful when you need the UI state to be updated synchronously after a change.
	 */
	flushStateChange() {

		if (this.triggerStateChangeTimeout === undefined) return;
		clearTimeout(this.triggerStateChangeTimeout);
		this.triggerOnContextChange();
	}

	private triggerOnContextChange() {
		
		if (this.pendingState === null) return;
		const newState = this.pendingState;
		this.triggerStateChangeTimeout = undefined;
		this.pendingState = null;
		this.onContextChange(newState);
	}

	getState() {

		return this.stateManager.getState();
	}

	createStateReader(state: IRemoteContextState) {

		return new RContextStateReader(this, state);
	}

	getOrphanEntities() {

		return [...this.stateManager.getOrphanEntities()];
	}

	removeObject(localUid: string) {

		const ent = this.objects[localUid];
		if (ent) this.setsDefinitions[ent.entitySetName]?.unregisterObject(localUid);
		this.emitStateChange('remove', [localUid]);
		delete this.objects[localUid];
	}

	/**
	 * @internal
	 * This function is designed for internal use only. It is used to find the uid of an entity
	 * @param entitySet 
	 * @param id 
	 * @returns 
	 */
	findEntityUid(entitySet: string, id: string | number) {

		id = id.toString();
		if (this.isUid(id)) return this.objects[id] ? id : null;

		const setDef = this.setsDefinitions[entitySet];
		if (setDef.keys.length === 0) return null;

		return setDef.findEntityByKeyString(id)?.localUid ?? null;
	}

	/**
	 * Builds requests for all the objects in the context
	 * @returns A record with the requests
	 */
	buildRequests() {

		const built: Record<string, IObjectRequest> = {};

		for (const objLocalUid in this.objects) {

			const obj = this.objects[objLocalUid];
			const req = obj.buildRequest();
			if (!req) continue;
			built[objLocalUid] = req;
		}

		return built;
	}

	/**
	 * Builds requests for the provided uids. Please note this method will also
	 * include the requests for the parent entitines whose actions are 'create'
	 * @param uids The uids of the entities to build requests for
	 * @returns A record with the requests
	 */
	buildRequestsForUids(uids: string[]) {

		const built: Record<string, IObjectRequest> = {};

		for (const objLocalUid of uids) {

			// Skip if the object has already been built
			if (built[objLocalUid]) continue;

			// Build the request for the object
			const obj = this.objects[objLocalUid];
			const req = obj.buildRequest();
			if (!req) continue;
			built[objLocalUid] = req;

			// Build the requests for the ascendant entities in creation mode
			const requiredAscendants = this.getAscendantUidsInCreationMode(objLocalUid);
			for (const ascUid of requiredAscendants) {
				const ascObj = this.objects[ascUid];
				const ascReq = ascObj.buildRequest();
				if (!ascReq || built[ascUid]) continue;
				built[ascUid] = ascReq;
			}
		}

		return built;
	}

	/**
	 * Returns the uids of the ascendant entities of the provided entity that are in creation mode
	 * @param uid The uid of the entity
	 * @returns The uids of the ascendant entities
	 */
	private getAscendantUidsInCreationMode(uid: string) {

		const ascendants: string[] = [];
		const state = this.getState();

		const parentsMap = state.map[uid].parentsMap;
		for (const parentSet in parentsMap) {
			const parentUid = parentsMap[parentSet];
			const parentEnt = this.objects[parentUid];
			if (parentEnt.getAction() === 'create') {
				ascendants.push(parentUid);
				ascendants.push(...this.getAscendantUidsInCreationMode(parentUid));
			}
		}

		return ascendants;
	}

	/**
	 * Syncs the context with the results of the requests
	 * @param resultsMap A record with the results of the requests
	 */
	sync(resultsMap: Record<string, IObjectResult>) {

		const uids: string[] = [];
		for (const localUid in resultsMap) {

			const reqItem = this.objects[localUid];

			if (!reqItem) {
				console.warn('RemoteEntityObject with UID ' + localUid + ' not found');
				continue;
			}

			const result = resultsMap[localUid];

			if (reqItem.getAction() === 'delete' && result.success === true) {

				this.removeObject(localUid);

			} else {

				uids.push(localUid);
				reqItem.sync(result);
			}
		}

		this.emitStateChange('update', uids);
	}

	/**
	 * Returns the uids of the objects that are not synced
	 */
	getUncommitedObjectsUids() {

		const unsavedEnts: string[] = [];
		for (const uid in this.objects) {
			const ent = this.objects[uid];
			if (!ent.isSynced()) {
				unsavedEnts.push(uid);
			}
		}

		return unsavedEnts;
	}

	/**
	 * @returns True if all the objects in the context are synced
	 */
	isSynced() {

		for (const uid in this.objects) {
			const ent = this.objects[uid];
			if (!ent.isSynced()) return false;
		}

		return true;
	}

	/**
	 * @returns True if the provided uid is a local uid
	 */
	isUid(uid: string) {

		return uid.indexOf(RContext.uidPrefix) === 0;
	}
}
