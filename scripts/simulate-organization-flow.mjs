function assert(condition, message) {
	if (!condition) throw new Error(message);
}

const vault = [
	{ id: 'e1', title: 'Leaving home without actually leaving', projectId: undefined, status: 'extracted' },
	{ id: 'e2', title: 'Father as pressure, not person', projectId: undefined, status: 'captured' },
	{ id: 'e3', title: 'Kitchen scene collapse', projectId: undefined, status: 'extracted' },
	{ id: 'e4', title: 'Town as emotional weather', projectId: 'book-1', status: 'extracted' },
];

const projects = {
	'book-1': {
		id: 'book-1',
		name: 'Staying Put',
		entryIds: ['e4'],
		outline: [
			{ id: 'ch1', title: 'The House Holds' },
			{ id: 'ch2', title: 'Kitchen Weather' },
			{ id: 'ch3', title: 'Leaving Without Leaving' },
		],
		draftedOutlineIds: ['ch1'],
	},
};

const bulkAttachIds = ['e1', 'e3'];
for (const entryId of bulkAttachIds) {
	const entry = vault.find((item) => item.id === entryId);
	assert(entry, `Missing entry ${entryId}`);
	entry.projectId = 'book-1';
	projects['book-1'].entryIds.push(entryId);
}

const unsorted = vault.filter((entry) => !entry.projectId);
const readyButUnsorted = unsorted.filter((entry) => entry.status === 'extracted');
const nextOutline = projects['book-1'].outline.find((item) => !projects['book-1'].draftedOutlineIds.includes(item.id));

assert(unsorted.length === 1, 'Expected one remaining unsorted capture after bulk attach');
assert(readyButUnsorted.length === 0, 'Expected no extracted captures left unsorted');
assert(nextOutline?.id === 'ch2', 'Expected next chapter target to move to chapter 2');
assert(projects['book-1'].entryIds.length === 3, 'Expected project to contain three captures after bulk attach');

console.log('ALIBI ORGANIZATION FLOW');
console.log('');
console.log('Vault');
console.log(`- starting captures: ${vault.length}`);
console.log(`- remaining unsorted: ${unsorted.length}`);
console.log(`- ready but unsorted: ${readyButUnsorted.length}`);
console.log(`- remaining unsorted title: ${unsorted[0]?.title ?? 'none'}`);
console.log('');
console.log('Project Assignment');
console.log(`- project: ${projects['book-1'].name}`);
console.log(`- attached in bulk: ${bulkAttachIds.length}`);
console.log(`- total attached: ${projects['book-1'].entryIds.length}`);
console.log('');
console.log('Chapter Targeting');
console.log(`- next target: ${nextOutline?.title ?? 'none'}`);
console.log(`- drafted already: ${projects['book-1'].draftedOutlineIds.length}`);
console.log('');
console.log('Result: organization simulation passed');
