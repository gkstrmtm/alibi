function truncateOneLine(raw, maxLen) {
	const cleaned = String(raw ?? '').replace(/\s+/g, ' ').trim();
	if (!cleaned) return '';
	if (cleaned.length <= maxLen) return cleaned;
	return `${cleaned.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
}

function inferTitleFromExtraction({ title, transcript, highlights, themes }) {
	const explicit = String(title ?? '').trim();
	if (explicit) return truncateOneLine(explicit, 56);
	const theme = (themes ?? []).find((item) => String(item ?? '').trim());
	if (theme) return truncateOneLine(theme, 56);
	const highlight = (highlights ?? []).find((item) => String(item ?? '').trim());
	if (highlight) return truncateOneLine(highlight, 56);
	return truncateOneLine(transcript, 56) || 'Entry';
}

function isGeneratedRecordingTitle(title) {
	const t = String(title ?? '').trim().toLowerCase();
	if (!t) return false;
	if (t === 'voice') return true;
	if (/^voice\s*[•-]\s*\d/.test(t)) return true;
	return false;
}

function countWords(text) {
	const trimmed = String(text ?? '').trim();
	if (!trimmed) return 0;
	return trimmed.split(/\s+/).filter(Boolean).length;
}

function estimateReadMinutes(text) {
	const words = countWords(text);
	return words ? Math.max(1, Math.ceil(words / 220)) : 0;
}

function buildPreviewExcerpt(text) {
	const normalized = String(text ?? '')
		.split(/\n{2,}/)
		.map((part) => part.replace(/\s+/g, ' ').trim())
		.filter(Boolean)
		.slice(0, 2)
		.join('\n\n');

	if (!normalized) return '';
	if (normalized.length <= 460) return normalized;
	return `${normalized.slice(0, 457).trimEnd()}…`;
}

function assert(condition, message) {
	if (!condition) throw new Error(message);
}

const now = Date.now();

const captures = [
	{
		id: 'e1',
		title: 'Voice • 0:48',
		projectId: undefined,
		status: 'extracted',
		themes: ['Leaving home without actually leaving'],
		highlights: ['The real story starts when the house stays the same but the person inside it changes.'],
		transcript:
			'I think this book is really about staying in the same town while your inner life outruns the place that made you. The house becomes a pressure chamber for memory and unfinished identity.',
	},
	{
		id: 'e2',
		title: 'Voice • 1:12',
		projectId: undefined,
		status: 'captured',
		transcript: 'I need a better chapter about the father because right now he only exists as pressure and not as a person.',
	},
	{
		id: 'e3',
		title: 'Kitchen scene collapse',
		projectId: 'book-1',
		status: 'extracted',
		themes: ['Family pressure'],
		highlights: ['The argument in the kitchen is the first time the narrator stops performing competence.'],
		transcript: 'The kitchen scene is where the mask breaks.',
	},
];

const project = {
	id: 'book-1',
	name: 'Staying Put',
	entryIds: ['e3'],
	draftIds: [],
	book: {
		outline: [
			{ id: 'ch1', title: 'The House Holds' },
			{ id: 'ch2', title: 'Kitchen Weather' },
			{ id: 'ch3', title: 'Leaving Without Leaving' },
		],
	},
};

const extractedTitle = isGeneratedRecordingTitle(captures[0].title)
	? inferTitleFromExtraction({ ...captures[0], title: undefined })
	: captures[0].title;
captures[0].title = extractedTitle;
captures[0].projectId = project.id;
project.entryIds.push(captures[0].id);

const unsorted = captures.filter((entry) => !entry.projectId);
assert(unsorted.length === 1, 'Expected one unsorted capture after assignment');
assert(captures[0].title !== 'Voice • 0:48', 'Expected extracted title to replace generic voice title');

const draft = {
	id: 'd1',
	title: 'Chapter Draft — Leaving Without Leaving',
	format: 'book-chapter',
	targetOutlineItemId: 'ch3',
	entryIds: ['e1', 'e3'],
	content: `The house never changes first. The people inside it do. That is the quiet violence at the center of this chapter: the narrator remains physically located, socially legible, and outwardly useful, while internally the old coordinates have already failed.

What looks like stasis is actually acceleration. The home keeps asking for an older self, one that can still absorb family pressure without translating it into anger or departure. By the time the kitchen scene arrives, the narrator is no longer deciding whether to leave. The narrator is deciding whether staying can still count as a form of truth.`,
};

const chapterIndex = project.book.outline.findIndex((item) => item.id === draft.targetOutlineItemId);
const previewExcerpt = buildPreviewExcerpt(draft.content);
const readMinutes = estimateReadMinutes(draft.content);
const readbackReady = Boolean(draft.content.trim() && readMinutes > 0);

assert(chapterIndex === 2, 'Expected draft to target the third outline item');
assert(readMinutes >= 1, 'Expected a non-zero read estimate');
assert(previewExcerpt.length > 0, 'Expected a preview excerpt');
assert(readbackReady, 'Expected chapter draft to be ready for readback');

console.log('ALIBI BOOK FLOW SMOKE');
console.log('');
console.log('Vault');
console.log(`- total captures: ${captures.length}`);
console.log(`- unsorted captures: ${unsorted.length}`);
console.log(`- renamed extracted capture: ${captures[0].title}`);
console.log('');
console.log('Project');
console.log(`- project: ${project.name}`);
console.log(`- attached captures: ${project.entryIds.length}`);
console.log(`- next unsorted capture: ${unsorted[0]?.title ?? 'none'}`);
console.log('');
console.log('Chapter Preview');
console.log(`- target: Chapter ${chapterIndex + 1} of ${project.book.outline.length} — ${project.book.outline[chapterIndex].title}`);
console.log(`- estimated read: ${readMinutes} min`);
console.log(`- readback ready: ${readbackReady ? 'yes' : 'no'}`);
console.log(`- preview: ${previewExcerpt}`);
console.log('');
console.log('Result: smoke simulation passed');
