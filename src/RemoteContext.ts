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
	//data: any;
	action: TAction;
	newData: T;
	keys: TKeysRecord | null;
}

export interface IParentKey {
	/**
	 * The order must be the same as the order of keys specified in the parent entitySet
	 */
	props: string[];
	entitySet: string;
}

interface ISetDefinition {
	name: string;
	keys: string[];
	parentKeys: IParentKey[];
}


export class RemoteContext {

	private static readonly uidPrefix = '~uid~';

	private uidIndex: number = 1;

	private objects: Record<string, RemoteEntityObject<any>> = {};

	private setsDefinitions: Record<string, ISetDefinition> = {};

	private readonly stateManager: RemoteContextStateManager;

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

	//deberia ser private
	getUid() {

		return RemoteContext.uidPrefix + (this.uidIndex++);
	}

	//deberia ser private
	emitStateChange(changeType: TStateChangeType, affectedUids: string[]) {

		const newState = this.stateManager.emitChange(changeType, affectedUids);
		if (typeof this.onContextChange !== 'function') return;
		this.onContextChange(newState);
	}

	getState() {
		return this.stateManager.getState();
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
		const isLocalUid = id.indexOf(RemoteContext.uidPrefix) === 0;
		if (isLocalUid) return this.objects[id] ? id : null;

		const setDef = this.setsDefinitions[entitySet];
		if (setDef.keys.length === 0) return null;

		//const key = setDef.keys[0];

		for (const uid in this.objects) {
			const iEnt = this.objects[uid];
			if (iEnt.entitySet !== entitySet) continue;
			// const iEntKey = iEnt.getData()[key];
			// if (iEntKey === undefined) throw new Error('Key property is not present in object. KEY: ' + key + ' | SET: ' + iEnt.entitySet);
			const iEntKey = buildObjectKey(iEnt.getData(), setDef.keys);

			if (iEntKey.toString() !== id) continue;
			return uid;
		}

		return null;
	}

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

				//if (result.success === true) {
				this.removeObject(localUid);
				// } else {
				// 	console.error('Error al eliminar objeto ', reqItem);
				// }

			} else {

				uids.push(localUid);
				reqItem.sync(result);
			}
		}

		this.emitStateChange('update', uids);
	}

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

	isSynced() {

		for (const uid in this.objects) {
			const ent = this.objects[uid];
			if (!ent.isSynced()) return false;
		}

		return true;
	}
}
