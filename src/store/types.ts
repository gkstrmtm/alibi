export type EntryStatus = 'captured' | 'processing' | 'extracted';

export type Entry = {
  id: string;
  title: string;
  createdAt: number;
  kind: 'voice' | 'text' | 'import';
  status: EntryStatus;
  intent?: string;
  targetFormat?: Draft['format'];
  durationSec?: number;
  transcript?: string;
  highlights?: string[];
  themes?: string[];
  ideas?: { title: string; detail?: string }[];
  projectId?: string;
};

export type ProjectType = 'standard' | 'book';

export type CanonCard = {
  id: string;
  kind: 'character' | 'world' | 'theme' | 'claim' | 'timeline';
  title: string;
  detail: string;
  updatedAt: number;
};

export type BookAssets = {
  brief: {
    premise: string;
    audience: string;
    tone: string;
    constraints: string;
  };
  outline: { id: string; title: string; note?: string }[];
  canon: CanonCard[];
};

export type Project = {
  id: string;
  name: string;
  type: ProjectType;
  createdAt: number;
  pinned: boolean;
  entryIds: string[];
  draftIds: string[];
  book?: BookAssets;
};

export type Draft = {
  id: string;
  projectId?: string;
  entryIds: string[];
  title: string;
  createdAt: number;
  format: 'essay' | 'commentary' | 'podcast-outline' | 'script' | 'thread' | 'book-chapter';
  tone: 'neutral' | 'reflective' | 'funny' | 'serious';
  distance: 'close' | 'expand' | 'invent';
  content: string;
  version: number;
};

export type StudioMode = 'interview' | 'build' | 'outline' | 'draft';

export type AppState = {
  entries: Record<string, Entry>;
  projects: Record<string, Project>;
  drafts: Record<string, Draft>;
  studio: {
    activeProjectId?: string;
    modeByProjectId: Record<string, StudioMode>;
  };
};

export type AppAction =
  | { type: 'entry.createText'; payload: { title?: string; text: string; intent?: string; targetFormat?: Draft['format'] } }
  | { type: 'entry.createRecordingPlaceholder'; payload: { title?: string; durationSec?: number } }
  | { type: 'entry.setStatus'; payload: { entryId: string; status: EntryStatus } }
  | {
      type: 'entry.setExtraction';
      payload: {
        entryId: string;
        transcript: string;
        highlights: string[];
        themes: string[];
        ideas: { title: string; detail?: string }[];
      };
    }
  | { type: 'project.create'; payload: { name: string; projectType: ProjectType } }
  | { type: 'project.togglePinned'; payload: { projectId: string } }
  | { type: 'project.addEntry'; payload: { projectId: string; entryId: string } }
  | {
      type: 'draft.create';
      payload: { draftId?: string; projectId?: string; entryIds: string[]; format: Draft['format']; title?: string; content?: string };
    }
  | { type: 'draft.regenerate'; payload: { draftId: string } }
  | { type: 'studio.setMode'; payload: { projectId: string; mode: StudioMode } }
  | { type: 'book.addCanonCard'; payload: { projectId: string; kind: CanonCard['kind']; title: string; detail: string } }
  | { type: 'book.addOutlineItem'; payload: { projectId: string; title: string } };
