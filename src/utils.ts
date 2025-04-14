import type { IParentKey } from './RContext';

export function buildObjectKey(obj: any, keyArr: string[]): number | string | null {

	if (keyArr.length === 1) {
		const prop = keyArr[0];

		if (obj[prop] === undefined) {
			throw new Error('Key "' + prop + '" is not defined. It must be a number, string or null');
		}
		return obj[prop];
	}

	const kvArr = keyArr.map(prop => {
		if (obj[prop] === undefined) {
			throw new Error('Key "' + prop + '" is not defined. It must be a number, string or null');
		}
		return obj[prop];
	});
	
	if (kvArr.every(v => v === null)) {
		return null;
	}

	return JSON.stringify(kvArr);
}


export function getParentKey(obj: any, pKey: IParentKey) {

	try {

		return buildObjectKey(obj, pKey.props);

	} catch (e) {
		throw new Error('Error building relational key: ' + (e as Error).message);
	}
}
