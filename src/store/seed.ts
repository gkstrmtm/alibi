import type { AppState } from './types';

export function makeSeedState(): AppState {
  return {
    entries: {},
    projects: {},
    drafts: {},
    settings: {
      apiBaseUrlOverride: undefined,
      ashtonModeEnabled: false,
      ashtonVoiceNotes: '',
    },
    auth: {
      status: 'unknown',
      userId: undefined,
      email: undefined,
    },
    profile: {
      status: 'idle',
      record: undefined,
      lastError: undefined,
    },
    sync: {
      status: 'idle',
      lastSyncAt: undefined,
      lastError: undefined,
    },
    studio: {
      activeProjectId: undefined,
      modeByProjectId: {},
      draftSelectionByProjectId: {},
      draftStyleByProjectId: {},
    },
  };
}
