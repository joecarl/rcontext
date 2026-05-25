import { RContext } from '../src/RContext';

interface ExampleEntityType1 {
	id: number;
	name: string;
}

interface ExampleEntityType2  extends ExampleEntityType1 { }

interface ExampleEntityType3 {
	id: number;
	parentId: number | null;
	name: string;
}

interface ExampleEntityType4  extends ExampleEntityType3 { }

interface ExampleEntityType5 {
	id: number;
	parentId: number | null;
	parentIdB: number | null;
	name: string;
}

interface ExampleEntityType6 {
	firstKey: number;
	secondKey: string;
	name: string;
}

export function createContext() {

	const ctx = new RContext();

	// Independent entity set
	const set1 = ctx.addEntitySet<ExampleEntityType1>({
		name: 'set1_independant',
		keys: ['id'],
	});

	// Independent entity set
	const set2 = ctx.addEntitySet<ExampleEntityType2>({
		name: 'set2_independant',
		keys: ['id'],
	});

	// Entity set whose parent is set1_independant
	const set3 = ctx.addEntitySet<ExampleEntityType3>({
		name: 'set3_dependsOn_set1',
		keys: ['id'],
		parentKeys: [
			{
				entitySet: set1,
				props: ['parentId'],
			}
		],
	});

	// Entity set whose parent is itself (self-referential: use addParentKey after creation)
	const set4 = ctx.addEntitySet<ExampleEntityType4>({
		name: 'set4_dependsOn_itself',
		keys: ['id'],
	});
	set4.addParentKey({ entitySet: set4, props: ['parentId'] });

	// Entity set with multiple parents
	const set5 = ctx.addEntitySet<ExampleEntityType5>({
		name: 'set5_dependsOn_set1_and_set2',
		keys: ['id'],
		parentKeys: [
			{
				entitySet: set1,
				props: ['parentId'],
			},
			{
				entitySet: set2,
				props: ['parentIdB'],
			}
		],
	});

	// Independent entity set with multiple keys
	const set6 = ctx.addEntitySet<ExampleEntityType6>({
		name: 'set6_multikey',
		keys: ['firstKey', 'secondKey'],
	});

	return { ctx, set1, set2, set3, set4, set5, set6 };
}