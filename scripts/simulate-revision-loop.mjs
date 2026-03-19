function assert(condition, message) {
	if (!condition) throw new Error(message);
}

function extractMarkdownSections(text) {
	const sections = [];
	const headingRe = /^(#{1,6})\s+(.+)$/gm;
	const matches = Array.from(text.matchAll(headingRe));
	for (let index = 0; index < matches.length; index += 1) {
		const match = matches[index];
		const start = match.index ?? 0;
		const end = index < matches.length - 1 ? matches[index + 1]?.index ?? text.length : text.length;
		sections.push({
			id: `${index}:${String(match[2]).toLowerCase()}`,
			heading: String(match[2]).trim(),
			start,
			end,
			markdown: text.slice(start, end).trim(),
		});
	}
	return sections;
}

function replaceSectionMarkdown(text, section, nextMarkdown) {
	return `${text.slice(0, section.start)}${String(nextMarkdown).trim()}\n\n${text.slice(section.end).trimStart()}`.trim();
}

function countWords(text) {
	const trimmed = String(text ?? '').trim();
	if (!trimmed) return 0;
	return trimmed.split(/\s+/).filter(Boolean).length;
}

function buildStoryGuide(text) {
	const tension = /\bbut\b|\bhowever\b|\byet\b|\bpressure\b|\bquestion\b|\?/i.test(text);
	const concrete = /\bkitchen\b|\bhouse\b|\broom\b|\bhand\b|\bvoice\b/i.test(text);
	const turn = /\bbecomes?\b|\bchanges?\b|\bturns?\b|\bdecides?\b|\bno longer\b/i.test(text);
	const ending = text.trim().split(/\n{2,}/).filter(Boolean).slice(-1)[0] ?? '';
	const forward = /\bnext\b|\bafter\b|\bnow\b|\bwill\b|\?/i.test(ending);

	return [
		{ label: 'Central tension', status: tension ? 'present' : 'develop' },
		{ label: 'Concrete detail', status: concrete ? 'present' : 'develop' },
		{ label: 'Turn or change', status: turn ? 'present' : 'develop' },
		{ label: 'Forward edge', status: forward || countWords(text) > 80 ? 'present' : 'develop' },
	];
}

const originalDraft = `# Leaving Without Leaving

The house does not change first. The people inside it do.

## Kitchen Weather

The kitchen scene works, but it stays too abstract and the father remains pressure instead of a person.

## What Staying Costs

The narrator begins to understand that staying can still rearrange a life.`;

const sections = extractMarkdownSections(originalDraft);
const target = sections.find((section) => section.heading === 'Kitchen Weather');
assert(target, 'Expected to find Kitchen Weather section');

const revisedSection = `## Kitchen Weather

The kitchen scene should narrow down to gestures, pauses, and one concrete exchange. The father is no longer just pressure in the room; he becomes a person with habits, fear, and a way of controlling the air without raising his voice.

That shift gives the chapter usable friction instead of general tension.`;

const nextDraft = replaceSectionMarkdown(originalDraft, target, revisedSection);
const nextSections = extractMarkdownSections(nextDraft);
const nextTarget = nextSections.find((section) => section.heading === 'Kitchen Weather');
const guide = buildStoryGuide(nextDraft);
const covered = guide.filter((item) => item.status === 'present').length;

assert(nextDraft.includes('The father is no longer just pressure in the room'), 'Expected revised section content to be present');
assert(nextDraft.includes('## What Staying Costs'), 'Expected later sections to remain intact');
assert(nextTarget?.markdown.includes('usable friction'), 'Expected revised target section to be updated');
assert(covered >= 3, 'Expected the soft story guide to mark most signals as present');

console.log('ALIBI REVISION LOOP');
console.log('');
console.log('Targeting');
console.log(`- sections detected: ${sections.length}`);
console.log(`- active target: ${target.heading}`);
console.log('');
console.log('Rewrite');
console.log('- instruction: make the father more concrete and reduce abstraction');
console.log(`- revised section length: ${revisedSection.length} chars`);
console.log('');
console.log('Story Guidance');
console.log(`- covered signals: ${covered}/${guide.length}`);
console.log(`- deepest gap: ${guide.find((item) => item.status === 'develop')?.label ?? 'none'}`);
console.log('');
console.log('Result');
console.log(`- preserved later section: ${nextDraft.includes('## What Staying Costs') ? 'yes' : 'no'}`);
console.log(`- target updated: ${nextTarget?.markdown.includes('usable friction') ? 'yes' : 'no'}`);
console.log('');
console.log('Result: revision simulation passed');
