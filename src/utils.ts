import type { IParentKey } from './RContext';

function isValidKeyType(value: any): value is string | number | null {

	return typeof value === 'string' || typeof value === 'number' || value === null;
}

export function buildObjectKey<T>(obj: T, keyArr: (keyof T & string)[]): number | string | null {

	if (keyArr.length === 1) {
		const prop = keyArr[0];

		if (!isValidKeyType(obj[prop])) {
			throw new Error('Key "' + prop + '" is not valid. It must be a number, string or null. Current type: ' + typeof obj[prop]);
		}
		return obj[prop];
	}

	const kvArr = keyArr.map(prop => {
		if (!isValidKeyType(obj[prop])) {
			throw new Error('Key "' + prop + '" is not valid. It must be a number, string or null. Current type: ' + typeof obj[prop]);
		}
		return obj[prop];
	});
	
	if (kvArr.every(v => v === null)) {
		return null;
	}

	return JSON.stringify(kvArr);
}


export function getParentKey<T>(obj: T, pKey: IParentKey<any, T>) {

	try {

		return buildObjectKey(obj, pKey.props);

	} catch (e) {
		throw new Error('Error building relational key: ' + (e as Error).message);
	}
}
