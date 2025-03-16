import { RContext } from '../src/RContext';

export function createContext() {
    
	const ctx = new RContext();

	// Indepedent entity set
	ctx.addEntitySet({
		name: 'set1_independant',
		keys: ['id'],
		parentKeys: []
	});

	// Indepedent entity set
	ctx.addEntitySet({
		name: 'set2_independant',
		keys: ['id'],
		parentKeys: []
	});

	// Entity set whose parent is set1_independant
	ctx.addEntitySet({
		name: 'set3_dependsOn_set1',
		keys: ['id'],
		parentKeys: [
			{
				entitySet: 'set1_independant',
				props: ['parentId']
			}
		]
	});

	// Entity set whose parent is itself
	ctx.addEntitySet({
		name: 'set4_dependsOn_itself',
		keys: ['id'],
		parentKeys: [
			{
				entitySet: 'set4_dependsOn_itself',
				props: ['parentId']
			}
		]
	});

	// Entity set with multiple parents
	ctx.addEntitySet({
		name: 'set5_dependsOn_set1_and_set2',
		keys: ['id'],
		parentKeys: [
			{
				entitySet: 'set1_independant',
				props: ['parentId']
			},
			{
				entitySet: 'set2_independant',
				props: ['parentIdB']
			}
		]
	});

	// Indepedent entity set with multiple keys
	ctx.addEntitySet({
		name: 'set6_multikey',
		keys: ['firstKey', 'secondKey'],
		parentKeys: []
	});

	return ctx;
}