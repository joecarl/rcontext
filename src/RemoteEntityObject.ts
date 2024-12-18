import type { RemoteContext, IObjectRequest, TAction, TKeysRecord } from './RemoteContext';

export class RemoteEntityObject<T> {

	public readonly localUid: string;

	private remoteData: T | null = null;

	private localData: Partial<T>;


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


	getAction() {
		return this.action;
	}


	getData() {

		if (this.remoteData === null) {
			return this.localData
		}

		return {
			...this.remoteData,
			...this.localData
		};
	}


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


	remove() {

		if (this.action === 'create') {
			this.ctx.removeObject(this.localUid);
		} else {
			this.action = 'delete';
			this.ctx.emitStateChange('update', [this.localUid]);
		}

	}


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

	getKeys() {

		const setDef = this.ctx.getEntitySetDefinition(this.entitySet);
		const keys: TKeysRecord = {};
		for (const key of setDef.keys) {
			const v = this.remoteData ? this.remoteData[key] : null;
			keys[key] = v;
		}
		return keys;
	}


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


	updateRemoteData(remoteData: T) {

		if (this.action === 'create') {
			throw new Error('Cannot update remote data of a local object');
		}
		this.remoteData = { ...this.remoteData, ...remoteData };
		this.ctx.emitStateChange('update', [this.localUid]);
	}


	sync(remoteSavedData: T) {

		if (!this.remoteData) {
			this.remoteData = { ...remoteSavedData };
		} else {
			this.remoteData = { ...this.remoteData, ...remoteSavedData };
		}
		this.localData = {};

		this.action = 'read';
	}

	isSynced() {

		//return Object.keys(this.localData).length === 0;
		return this.action === 'read';
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
