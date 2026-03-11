import React, { createContext, useContext, useMemo, useReducer } from 'react';

import { makeId } from '../utils/id';
import { makeSeedState } from './seed';
import type { AppAction, AppState, Draft, Entry, Project } from './types';

type AppStore = {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
};

const AppStoreContext = createContext<AppStore | undefined>(undefined);

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'entry.createText': {
      const id = makeId('entry');
      const now = Date.now();
      const entry: Entry = {
        id,
        title: action.payload.title?.trim() || 'Untitled note',
        createdAt: now,
        kind: 'text',
        status: 'captured',
        transcript: action.payload.text,
      };
      return {
        ...state,
        entries: {
          ...state.entries,
          [id]: entry,
        },
      };
    }
    case 'entry.createRecordingPlaceholder': {
      const id = makeId('entry');
      const now = Date.now();
      const entry: Entry = {
        id,
        title: action.payload.title?.trim() || 'Untitled recording',
        createdAt: now,
        kind: 'voice',
        status: 'captured',
        durationSec: action.payload.durationSec,
      };
      return {
        ...state,
        entries: {
          ...state.entries,
          [id]: entry,
        },
      };
    }
    case 'entry.setStatus': {
      const entry = state.entries[action.payload.entryId];
      if (!entry) return state;
      return {
        ...state,
        entries: {
          ...state.entries,
          [entry.id]: {
            ...entry,
            status: action.payload.status,
          },
        },
      };
    }
    case 'entry.setExtraction': {
      const entry = state.entries[action.payload.entryId];
      if (!entry) return state;
      return {
        ...state,
        entries: {
          ...state.entries,
          [entry.id]: {
            ...entry,
            status: 'extracted',
            transcript: action.payload.transcript,
            highlights: action.payload.highlights,
            themes: action.payload.themes,
            ideas: action.payload.ideas,
          },
        },
      };
    }
    case 'project.create': {
      const id = makeId('proj');
      const now = Date.now();
      const project: Project = {
        id,
        name: action.payload.name.trim() || 'Untitled project',
        type: action.payload.projectType,
        createdAt: now,
        pinned: false,
        entryIds: [],
        draftIds: [],
        book:
          action.payload.projectType === 'book'
            ? {
                brief: {
                  premise: '',
                  audience: '',
                  tone: '',
                  constraints: '',
                },
                canon: [],
                outline: [],
              }
            : undefined,
      };
      return {
        ...state,
        projects: {
          ...state.projects,
          [id]: project,
        },
      };
    }
    case 'project.togglePinned': {
      const project = state.projects[action.payload.projectId];
      if (!project) return state;
      return {
        ...state,
        projects: {
          ...state.projects,
          [project.id]: {
            ...project,
            pinned: !project.pinned,
          },
        },
      };
    }
    case 'project.addEntry': {
      const project = state.projects[action.payload.projectId];
      const entry = state.entries[action.payload.entryId];
      if (!project || !entry) return state;

      const entryIds = project.entryIds.includes(entry.id) ? project.entryIds : [entry.id, ...project.entryIds];
      return {
        ...state,
        projects: {
          ...state.projects,
          [project.id]: {
            ...project,
            entryIds,
          },
        },
        entries: {
          ...state.entries,
          [entry.id]: {
            ...entry,
            projectId: project.id,
          },
        },
      };
    }
    case 'draft.create': {
      const id = action.payload.draftId ?? makeId('draft');
      const now = Date.now();
      const format = action.payload.format;
      const tone: Draft['tone'] = 'neutral';
      const distance: Draft['distance'] = 'close';

      const draft: Draft = {
        id,
        projectId: action.payload.projectId,
        entryIds: action.payload.entryIds,
        title: action.payload.title?.trim() || 'Draft',
        createdAt: now,
        format,
        tone,
        distance,
        content: action.payload.content ?? '(Placeholder draft.)',
        version: 1,
      };

      const nextState: AppState = {
        ...state,
        drafts: {
          ...state.drafts,
          [id]: draft,
        },
      };

      if (draft.projectId) {
        const project = state.projects[draft.projectId];
        if (!project) return nextState;
        nextState.projects = {
          ...state.projects,
          [project.id]: {
            ...project,
            draftIds: [draft.id, ...project.draftIds],
          },
        };
      }

      return nextState;
    }
    case 'draft.regenerate': {
      const draft = state.drafts[action.payload.draftId];
      if (!draft) return state;
      const next: Draft = {
        ...draft,
        version: draft.version + 1,
        createdAt: Date.now(),
        content: `${draft.content}\n\n(Regenerated v${draft.version + 1} placeholder.)`,
      };
      return {
        ...state,
        drafts: {
          ...state.drafts,
          [draft.id]: next,
        },
      };
    }
    case 'studio.setMode': {
      return {
        ...state,
        studio: {
          ...state.studio,
          activeProjectId: action.payload.projectId,
          modeByProjectId: {
            ...state.studio.modeByProjectId,
            [action.payload.projectId]: action.payload.mode,
          },
        },
      };
    }
    case 'book.addCanonCard': {
      const project = state.projects[action.payload.projectId];
      if (!project?.book) return state;
      const cardId = makeId('canon');
      const updatedAt = Date.now();
      return {
        ...state,
        projects: {
          ...state.projects,
          [project.id]: {
            ...project,
            book: {
              ...project.book,
              canon: [
                {
                  id: cardId,
                  kind: action.payload.kind,
                  title: action.payload.title,
                  detail: action.payload.detail,
                  updatedAt,
                },
                ...project.book.canon,
              ],
            },
          },
        },
      };
    }
    case 'book.addOutlineItem': {
      const project = state.projects[action.payload.projectId];
      if (!project?.book) return state;
      return {
        ...state,
        projects: {
          ...state.projects,
          [project.id]: {
            ...project,
            book: {
              ...project.book,
              outline: [{ id: makeId('ch'), title: action.payload.title }, ...project.book.outline],
            },
          },
        },
      };
    }
    default:
      return state;
  }
}

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, makeSeedState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error('useAppStore must be used within AppStoreProvider');
  return ctx;
}
