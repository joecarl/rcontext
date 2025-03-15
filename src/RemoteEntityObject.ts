import type { RemoteContext, IObjectRequest, TAction, TKeysRecord, IObjectResult } from './RemoteContext';

export class RemoteEntityObject<T> {

	public readonly localUid: string;

	private remoteData: T | null = null;

	private localData: Partial<T>;

	private syncResult: IObjectResult<T> | null = null;


	constructor(
		private readonly ctx: RemoteContext,
		public readonly entitySet: string,
		private action: TAction,
		data: T | null,
		localData?: Partial<T>
	) {

		this.localUid = this.ctx.getUid();

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

		this.ctx.emitStateChange('update', [this.localUid]);
	}

	/**
	 * Marks the object for deletion
	 */
	remove() {

		if (this.action === 'create') {
			this.ctx.removeObject(this.localUid);
		} else {
			this.action = 'delete';
			this.ctx.emitStateChange('update', [this.localUid]);
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
		this.ctx.emitStateChange('update', [this.localUid]);
	}

	/**
	 * Removes the object from the context immediately without waiting for the sync
	 */
	removeImmediately() {
		
		this.remove();
		this.ctx.sync({
			[this.localUid]: {
				success: true,
				data: null,
				message: '',
				feedback: null,
			},
		});
	}

	/**
	 * Returns the state of a field in the object
	 * @param fieldName The name of the field
	 */
	getFieldState(fieldName: string) {

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
		const setDef = this.ctx.getEntitySetDefinition(this.entitySet);
		const keys: TKeysRecord = {};
		for (const key of setDef.keys) {
			const v = this.remoteData ? this.remoteData[key] : null;
			keys[key] = v;
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
				entitySet: this.entitySet,
				remoteUid: this.localUid,
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
		this.ctx.emitStateChange('update', [this.localUid]);
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
			return this.localUid;
		}

		const setDef = this.ctx.getEntitySetDefinition(this.entitySet);
		if (setDef.keys.length !== 1) throw new Error('Multi key relational parent is not supported');
		const keyProp = setDef.keys[0];
		const keyVal = this.remoteData ? this.remoteData[keyProp] : null;
		return keyVal;
	}

}
