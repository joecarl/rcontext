import type { RContext, IObjectRequest, EntityAction, EntityKeysRecord, IObjectResult } from './RContext';

/** @deprecated Use EntityObject instead, this is an alias to keep retrocompatibility with the previous version of the library */
export type RemoteEntityObject<T> = EntityObject<T>;

export class EntityObject<T> {

	public readonly cid: string;

	/**@deprecated Use cid instead, this is an alias to keep retrocompatibility with the previous version of the library */
	public readonly localUid: string;

	private remoteData: T | null = null;

	private localData: Partial<T>;

	private syncResult: IObjectResult<T> | null = null;


	constructor(
		private readonly ctx: RContext,
		public readonly entitySetName: string,
		private action: EntityAction,
		data: T | null,
		localData?: Partial<T>
	) {

		this.cid = this.ctx.getNewUid();
		this.localUid = this.cid;
		this.action = action ?? null;
		if (this.action === 'create') {
			this.remoteData = null;
		} else {
			this.remoteData = data;
		}

		this.localData = localData ? { ...localData } : {};
	}

	/**
	 * @returns The action to be performed on the object
	 */
	getAction() {

		return this.action;
	}

	/**
	 * @returns The data of the object, if the object is in creation mode the local data is returned
	 */
	getData() {

		if (this.remoteData === null) {
			return this.localData;
		}

		return {
			...this.remoteData,
			...this.localData
		};
	}

	/**
	 * Updates the local data of the object
	 * @param newData 
	 */
	edit(newData: Partial<T>) {

		if (this.action === 'read') {
			this.action = 'update';
		}

		this.localData = {
			...this.localData,
			...newData
		};

		this.ctx.emitStateChange('update', [this.cid]);
	}

	/**
	 * Marks the object for deletion
	 */
	remove() {

		if (this.action === 'create') {
			this.ctx.removeObject(this.cid);
		} else {
			this.action = 'delete';
			this.ctx.emitStateChange('update', [this.cid]);
		}
	}

	/**
	 * Cancels the remove action
	 */
	cancelRemove() {

		if (this.action !== 'delete') {
			throw new Error('Cannot cancel remove on a non delete object');
		}

		this.action = Object.keys(this.localData).length > 0 ? 'update' : 'read';
		this.ctx.emitStateChange('update', [this.cid]);
	}

	/**
	 * Removes the object from the context immediately without waiting for the sync
	 */
	removeImmediately() {

		this.remove();
		this.ctx.sync({
			[this.cid]: {
				success: true,
				data: null,
				message: '',
				feedback: null,
			},
		});
	}

	/**
	 * Removes the object from the context without marking it for deletion and without
	 * going through the sync cycle. The server will not be notified.
	 */
	untrack(): void {

		this.ctx.removeObject(this.cid);
	}

	/**
	 * Discards all local unsaved changes on this object:
	 * - If the action is 'create': removes the object from the context entirely.
	 * - If the action is 'update' or 'delete': resets the local data and restores
	 *   the action to 'read', reverting to the last synced remote state.
	 * - If the action is 'read': no-op (nothing to discard).
	 */
	discardChanges(): void {

		if (this.action === 'read') {
			return;
		}

		if (this.action === 'create') {
			this.ctx.removeObject(this.cid);
			return;
		}

		// action is 'update' or 'delete'
		this.localData = {};
		this.syncResult = null;
		this.action = 'read';
		this.ctx.emitStateChange('update', [this.cid]);
	}

	/**
	 * Returns the state of a field in the object
	 * @param fieldName The name of the field
	 */
	getFieldState(fieldName: keyof T) {

		if (this.remoteData === null || this.remoteData === undefined) {

			if (this.localData[fieldName] === undefined) {
				return 'none';
			}

			return 'unsaved';
		}

		if (this.localData[fieldName] === this.remoteData[fieldName]) {
			return 'saved';
		}

		return 'unsaved';
	}

	/**
	 * @returns The keys of the entity, if the entity is in creation mode null is returned
	 */
	getKeys() {

		if (this.action === 'create') return null;
		const setDef = this.ctx.getSetDefinition(this.entitySetName);
		const keys: EntityKeysRecord = {};
		for (const key of setDef.keys) {
			const k = key as keyof T;
			const v = this.remoteData ? this.remoteData[k] : null;
			(keys as any)[k] = v;
		}
		return keys;
	}

	/**
	 * Builds a request object to be sent to the server
	 */
	buildRequest(): IObjectRequest | null {

		if (this.action === 'read') {

			return null;

		} else {

			return {
				entitySet: this.entitySetName,
				remoteUid: this.cid,
				newData: this.localData,
				action: this.action,
				keys: this.getKeys(),
			};
		}
	}

	/**
	 * Updates the remote data of the object, this method is used to update the object
	 * after a successful sync
	 * @param remoteData 
	 */
	updateRemoteData(remoteData: T) {

		if (this.action === 'create') {
			throw new Error('Cannot update remote data of a local object');
		}
		this.remoteData = { ...this.remoteData, ...remoteData };
		this.ctx.emitStateChange('update', [this.cid]);
	}

	/**
	 * Syncs the object with the remote state
	 * @param syncResult 
	 * @returns 
	 */
	sync(syncResult: IObjectResult<T>) {

		this.syncResult = syncResult;
		if (!this.syncResult.success) {
			return;
		}
		if (!syncResult.data) {
			return;
		}

		if (!this.remoteData) {
			this.remoteData = { ...syncResult.data };
		} else {
			this.remoteData = { ...this.remoteData, ...syncResult.data };
		}
		this.localData = {};

		this.action = 'read';
	}

	/**
	 * @returns True if the object is synced with the remote state
	 */
	isSynced() {

		//return Object.keys(this.localData).length === 0;
		return this.action === 'read';
	}

	/**
	 * @returns The feedback of the last sync operation
	 */
	getSyncResult() {

		return this.syncResult;
	}

	/**
	 * Returns the entity as a relational key which can be used as the parent key of 
	 * other entity, if entity is in creation mode the uid will be returned, if the
	 * object has multiple keys an error is thrown
	 */
	toRelationalKey() {

		if (this.action === 'create') {
			return this.cid;
		}

		const setDef = this.ctx.getSetDefinition(this.entitySetName);
		if (setDef.keys.length !== 1) throw new Error('Multi key relational parent is not supported');
		const keyProp = setDef.keys[0] as keyof T;
		const keyVal = this.remoteData ? this.remoteData[keyProp] : null;
		return keyVal;
	}
}
