import type { IRemoteContextState, TStateChangeType } from './RemoteContextStateManager';
import { RemoteEntityObject } from './RemoteEntityObject';
import { RemoteContextStateManager } from './RemoteContextStateManager';
import { buildObjectKey } from './utils';

export type TSets = Record<string, string[]>;

export type TAction = 'create' | 'read' | 'update' | 'delete';

export type TKeysRecord = Record<string, string | number>;

export interface IObjectResult<T = any> {
	success: boolean;
	message: string;
	data: T | null;
	feedback: Record<keyof T, string> | null;
}

export interface IObjectRequest<T = any> {
	entitySet: string;
	remoteUid: string;
	action: TAction;
	newData: T;
	keys: TKeysRecord | null;
}

export interface IParentKey {
	/**
	 * The order must be the same as the order of keys specified in the parent entitySet
	 */
	props: string[];

	/**
	 * The name of the parent entitySet
	 */
	entitySet: string;
}

interface ISetDefinition {
	name: string;
	keys: string[];
	parentKeys: IParentKey[];
}


export class RContext {

	private static readonly uidPrefix = '~uid~';

	private readonly stateManager: RemoteContextStateManager;

	private uidIndex: number = 1;

	private objects: Record<string, RemoteEntityObject<any>> = {};

	private setsDefinitions: Record<string, ISetDefinition> = {};

	private triggerStateChangeTimeout: any;

	public onContextChange: (newState: IRemoteContextState) => void;


	constructor() {

		this.stateManager = new RemoteContextStateManager(this);
	}

	addEntitySet(setDefinition: ISetDefinition) {

		const setName = setDefinition.name;
		this.setsDefinitions[setName] = setDefinition;
	}

	private validateEntitySet(entitySetName: string) {

		if (this.setsDefinitions[entitySetName] === undefined) {
			throw new Error('Entity set ' + entitySetName + ' is not registered. Did you forget to call addEntitySet?');
		}
	}

	private registerObject(ent: RemoteEntityObject<any>) {

		this.objects[ent.localUid] = ent;
		this.emitStateChange('add', [ent.localUid]);
	}

	createObject<T>(entitySet: string, obj: Partial<T>) {

		this.validateEntitySet(entitySet);
		const ent = new RemoteEntityObject<T>(this, entitySet, 'create', null, obj);
		this.registerObject(ent);
		return ent;
	}

	trackObject<T>(entitySet: string, obj: T) {

		this.validateEntitySet(entitySet);
		const existingEnt = this.findEntity(entitySet, obj);
		if (existingEnt) {
			existingEnt.updateRemoteData(obj);
			return existingEnt;
		}
		const ent = new RemoteEntityObject<T>(this, entitySet, 'read', obj);
		this.registerObject(ent);
		return ent;
	}

	getObject(uid: string) {
		return this.objects[uid];
	}

	getSetDefinition(setName: string) {
		return this.setsDefinitions[setName];
	}

	getNewUid() {

		return RContext.uidPrefix + (this.uidIndex++);
	}

	//deberia ser private
	/**
	 * Tells the state manager to emit a state change
	 * @param changeType 'add' if the objects must be added, 'update' if the objects must be updated, 'remove' if the objects must be removed
	 * @param affectedUids the uids of the objects that are affected by the change
	 */
	emitStateChange(changeType: TStateChangeType, affectedUids: string[]) {

		const newState = this.stateManager.emitChange(changeType, affectedUids);
		
		if (typeof this.onContextChange !== 'function') return;

		clearTimeout(this.triggerStateChangeTimeout);
		this.triggerStateChangeTimeout = setTimeout(() => {
			this.onContextChange(newState);
		}, 1);
	}

	getState() {

		return this.stateManager.getState();
	}

	getOrphanEntities() {

		return this.stateManager.getOrphanEntities();
	}

	removeObject(localUid: string) {

		this.emitStateChange('remove', [localUid]);
		delete this.objects[localUid];
	}

	getEntitySetDefinition(setName: string): ISetDefinition {

		return this.setsDefinitions[setName];
	}

	findEntity(entitySet: string, keyValues: any) {

		const setDef = this.setsDefinitions[entitySet];
		if (setDef.keys.length === 0) return null;

		for (const uid in this.objects) {
			const iEnt = this.objects[uid];
			if (iEnt.entitySet !== entitySet) continue;
			const entData = iEnt.getData();
			let matches = true;
			for (const key of setDef.keys) {
				if (keyValues[key] !== entData[key]) {
					matches = false;
					break;
				}
			}
			if (!matches) continue;
			return iEnt;
		}

		return null;
	}

	findEntityUid(entitySet: string, id: string | number) {

		id = id.toString();
		const isLocalUid = id.indexOf(RContext.uidPrefix) === 0;
		if (isLocalUid) return this.objects[id] ? id : null;

		const setDef = this.setsDefinitions[entitySet];
		if (setDef.keys.length === 0) return null;

		for (const uid in this.objects) {
			const iEnt = this.objects[uid];
			if (iEnt.entitySet !== entitySet) continue;
			const iEntKey = buildObjectKey(iEnt.getData(), setDef.keys);

			if (iEntKey.toString() !== id) continue;
			return uid;
		}

		return null;
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
}
