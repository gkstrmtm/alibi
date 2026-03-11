import { makeId } from '../utils/id';
import type { AppState, Draft, Entry, Project } from './types';

export function makeSeedState(): AppState {
  const now = Date.now();

  const entry1: Entry = {
    id: makeId('entry'),
    title: 'Untitled thought',
    createdAt: now - 1000 * 60 * 30,
    kind: 'voice',
    status: 'extracted',
    durationSec: 92,
    transcript: 'I keep circling the same idea: a book that feels like a conversation with your future self…',
    highlights: [
      'A book that feels like a conversation with your future self.',
      'The core promise is: clarity without flattening.',
    ],
    themes: ['Identity', 'Time', 'Clarity'],
    ideas: [
      { title: 'Future-self book framing', detail: 'Use letters / dialogues as structure.' },
      { title: 'Clarity without flattening', detail: 'Keep the voice; reduce chaos.' },
      { title: 'Recurring motif', detail: 'A question asked every chapter.' },
    ],
  };

  const entry2: Entry = {
    id: makeId('entry'),
    title: 'Typed fragment',
    createdAt: now - 1000 * 60 * 12,
    kind: 'text',
    status: 'captured',
  };

  const project1: Project = {
    id: makeId('proj'),
    name: 'Book: Future-Self Letters',
    type: 'book',
    createdAt: now - 1000 * 60 * 60 * 24,
    pinned: true,
    entryIds: [entry1.id],
    draftIds: [],
    book: {
      brief: {
        premise: 'A practical + intimate book written as letters to your future self.',
        audience: 'People building a life project who feel scattered.',
        tone: 'Warm, precise, slightly cinematic.',
        constraints: 'No clichés; concrete examples; voice stays human.',
      },
      canon: [],
      outline: [
        { id: makeId('ch'), title: 'Chapter 1 — The First Letter' },
        { id: makeId('ch'), title: 'Chapter 2 — What You Refuse To Name' },
      ],
    },
  };

  const draft1: Draft = {
    id: makeId('draft'),
    projectId: project1.id,
    entryIds: [entry1.id],
    title: 'Draft — Opening page',
    createdAt: now - 1000 * 60 * 5,
    format: 'book-chapter',
    tone: 'reflective',
    distance: 'expand',
    content:
      'Dear future me,\n\nI’m writing because I keep noticing the same loop…\n\n(Placeholder draft content.)',
    version: 1,
  };

  project1.draftIds.push(draft1.id);

  return {
    entries: {
      [entry1.id]: entry1,
      [entry2.id]: entry2,
    },
    projects: {
      [project1.id]: project1,
    },
    drafts: {
      [draft1.id]: draft1,
    },
    studio: {
      activeProjectId: project1.id,
      modeByProjectId: {
        [project1.id]: 'interview',
      },
    },
  };
}
