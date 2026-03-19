import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useReducer, useState } from 'react';

import { makeInstantRecordingTitle } from '../utils/entryTitles';
import { estimateVoiceDurationSecFromTranscript } from '../utils/entryDuration';
import { makeId } from '../utils/id';
import { isUuid, normalizeNarrativeReferences } from '../utils/outlineIdentity';
import { createNarrativeScaffold, deriveTargetPartCount, ensureNarrativeOutlineForDraft } from '../utils/narrativeProgress';
import { getSupabaseClient } from '../supabase/client';
import { supabaseEnsureMyProfile, supabaseGetMyProfile } from '../supabase/profile';
import { supabaseHasAnyData, supabasePullAll, supabasePushAll } from '../supabase/sync';
import { buildStateWithAddedProjectEntry, buildStateWithProjectEntries } from './projectMembership';
import { makeSeedState } from './seed';
import type { AppAction, AppState, Draft, Entry, Project, UserProfile } from './types';

type AppStore = {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
};

const STORAGE_KEY = 'alibi.appState.v1';

const AppStoreContext = createContext<AppStore | undefined>(undefined);

function truncateOneLine(raw: string, maxLen: number): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, Math.max(0, maxLen - 1)).trimEnd() + '…';
}

function inferTitleFromText(text: string): string {
  const firstNonEmptyLine =
    text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? '';
  const title = truncateOneLine(firstNonEmptyLine || text, 56);
  return title || 'Note';
}

function formatDurationSec(totalSec?: number): string {
  if (typeof totalSec !== 'number' || !Number.isFinite(totalSec) || totalSec < 0) return '';
  const sec = Math.floor(totalSec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m <= 0) return `${s}s`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function isPlaceholderEntryTitle(title: string | undefined): boolean {
  const t = (title ?? '').trim().toLowerCase();
  return (
    t === 'untitled' ||
    t === 'untitled note' ||
    t === 'untitled recording' ||
    t === 'imported transcript' ||
    t === 'uploaded file' ||
    t === 'uploaded video'
  );
}

function isGeneratedRecordingTitle(title: string | undefined): boolean {
  const t = (title ?? '').trim().toLowerCase();
  if (!t) return false;
  if (t === 'voice') return true;
  if (/^voice\s*[•-]\s*\d/.test(t)) return true;
  if (/^voice\s+\d/.test(t)) return true;
  if (t === 'insight') return true;
  if (/^insight\s*[•-]/.test(t)) return true;
  if (/^insight\s+\d/.test(t)) return true;
  if (t.startsWith('intake —')) return true;
  return false;
}

function shouldReplaceEntryTitleWithExtraction(entry: Pick<Entry, 'title' | 'kind'>): boolean {
  if (isPlaceholderEntryTitle(entry.title)) return true;
  if (isGeneratedRecordingTitle(entry.title)) return true;
  return entry.kind === 'voice' && !entry.title.trim();
}

function inferTitleFromExtraction(payload: {
  title?: string;
  transcript: string;
  highlights: string[];
  themes: string[];
}): string {
  const explicit = payload.title?.trim();
  if (explicit) return truncateOneLine(explicit, 56);

  const theme = payload.themes?.[0];
  if (typeof theme === 'string' && theme.trim()) return truncateOneLine(theme, 56);

  const hl = payload.highlights?.[0];
  if (typeof hl === 'string' && hl.trim()) return truncateOneLine(hl, 56);

  return inferTitleFromText(payload.transcript || '');
}

async function waitForSupabaseSession(userId?: string, timeoutMs = 2500): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase || !userId) return false;

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user?.id === userId) return true;
    } catch {
      // ignore and retry briefly
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return false;
}

function ensureUuidIds(rawState: any): any {
  const state = rawState && typeof rawState === 'object' ? rawState : {};

  const entriesRaw: Record<string, any> = state.entries && typeof state.entries === 'object' ? state.entries : {};
  const projectsRaw: Record<string, any> = state.projects && typeof state.projects === 'object' ? state.projects : {};
  const draftsRaw: Record<string, any> = state.drafts && typeof state.drafts === 'object' ? state.drafts : {};

  const entryIdMap = new Map<string, string>();
  const projectIdMap = new Map<string, string>();
  const draftIdMap = new Map<string, string>();
  const canonIdMap = new Map<string, string>();

  for (const [key, entry] of Object.entries(entriesRaw)) {
    const current = typeof entry?.id === 'string' ? entry.id : key;
    if (isUuid(current)) continue;
    entryIdMap.set(current, makeId('entry'));
  }

  for (const [key, project] of Object.entries(projectsRaw)) {
    const current = typeof project?.id === 'string' ? project.id : key;
    if (isUuid(current)) continue;
    projectIdMap.set(current, makeId('proj'));
  }

  for (const [key, draft] of Object.entries(draftsRaw)) {
    const current = typeof draft?.id === 'string' ? draft.id : key;
    if (isUuid(current)) continue;
    draftIdMap.set(current, makeId('draft'));
  }

  function mapEntryId(id: unknown): string | undefined {
    if (typeof id !== 'string') return undefined;
    return entryIdMap.get(id) ?? id;
  }
  function mapProjectId(id: unknown): string | undefined {
    if (typeof id !== 'string') return undefined;
    return projectIdMap.get(id) ?? id;
  }
  function mapDraftId(id: unknown): string | undefined {
    if (typeof id !== 'string') return undefined;
    return draftIdMap.get(id) ?? id;
  }

  const entries: Record<string, any> = {};
  for (const entry of Object.values(entriesRaw)) {
    const oldId = typeof entry?.id === 'string' ? entry.id : undefined;
    const id = mapEntryId(oldId) ?? makeId('entry');

    const rawTitle = typeof entry?.title === 'string' ? entry.title : '';
    let nextTitle = rawTitle;
      if (!nextTitle.trim() || isPlaceholderEntryTitle(nextTitle) || (entry?.status === 'extracted' && isGeneratedRecordingTitle(nextTitle))) {
      const kind = entry?.kind;
      if (entry?.status === 'extracted') {
        nextTitle = inferTitleFromExtraction({
          transcript: typeof entry?.transcript === 'string' ? entry.transcript : '',
          highlights: Array.isArray(entry?.highlights) ? entry.highlights : [],
          themes: Array.isArray(entry?.themes) ? entry.themes : [],
        });
      } else if (kind === 'voice') {
        nextTitle = makeInstantRecordingTitle({ startedAt: typeof entry?.createdAt === 'number' ? entry.createdAt : undefined });
      } else if (typeof entry?.transcript === 'string') {
        nextTitle = inferTitleFromText(entry.transcript);
      } else {
        nextTitle = 'Entry';
      }
    }
    entries[id] = {
      ...entry,
      id,
      title: nextTitle,
      durationSec:
        entry?.kind === 'voice'
          ? (typeof entry?.durationSec === 'number' && entry.durationSec > 0 ? entry.durationSec : estimateVoiceDurationSecFromTranscript(typeof entry?.transcript === 'string' ? entry.transcript : undefined) || undefined)
          : entry?.durationSec,
      projectId: mapProjectId(entry?.projectId),
    };
  }

  const drafts: Record<string, any> = {};
  for (const draft of Object.values(draftsRaw)) {
    const oldId = typeof draft?.id === 'string' ? draft.id : undefined;
    const id = mapDraftId(oldId) ?? makeId('draft');
    const entryIds = Array.isArray(draft?.entryIds) ? draft.entryIds.map(mapEntryId).filter(Boolean) : [];
    drafts[id] = {
      ...draft,
      id,
      projectId: mapProjectId(draft?.projectId),
      entryIds,
    };
  }

  const projects: Record<string, any> = {};
  for (const project of Object.values(projectsRaw)) {
    const oldId = typeof project?.id === 'string' ? project.id : undefined;
    const id = mapProjectId(oldId) ?? makeId('proj');
    const entryIds = Array.isArray(project?.entryIds) ? project.entryIds.map(mapEntryId).filter(Boolean) : [];
    const draftIds = Array.isArray(project?.draftIds) ? project.draftIds.map(mapDraftId).filter(Boolean) : [];

    const book = project?.book;
    let nextBook = book;
    if (book && typeof book === 'object') {
      const canon = Array.isArray(book.canon)
        ? book.canon.map((c: any) => {
            const oldCanonId = typeof c?.id === 'string' ? c.id : undefined;
            let nextCanonId = oldCanonId;
            if (!isUuid(nextCanonId)) {
              if (typeof oldCanonId === 'string') {
                canonIdMap.set(oldCanonId, canonIdMap.get(oldCanonId) ?? makeId('canon'));
                nextCanonId = canonIdMap.get(oldCanonId);
              } else {
                nextCanonId = makeId('canon');
              }
            }
            return { ...c, id: nextCanonId };
          })
        : [];
      const outline = Array.isArray(book.outline)
        ? book.outline.map((o: any) => ({ ...o, id: isUuid(o?.id) ? o.id : makeId('ch') }))
        : [];
      nextBook = { ...book, canon, outline };
    }

    projects[id] = {
      ...project,
      id,
      entryIds,
      draftIds,
      book: nextBook,
    };
  }

  const studioRaw = state.studio && typeof state.studio === 'object' ? state.studio : {};
  const activeProjectId = mapProjectId(studioRaw.activeProjectId);
  const modeByProjectIdRaw: Record<string, any> =
    studioRaw.modeByProjectId && typeof studioRaw.modeByProjectId === 'object' ? studioRaw.modeByProjectId : {};
  const modeByProjectId: Record<string, any> = {};
  for (const [k, v] of Object.entries(modeByProjectIdRaw)) {
    const mapped = mapProjectId(k);
    if (!mapped) continue;
    modeByProjectId[mapped] = v;
  }

  const draftSelectionByProjectIdRaw: Record<string, any> =
    studioRaw.draftSelectionByProjectId && typeof studioRaw.draftSelectionByProjectId === 'object'
      ? studioRaw.draftSelectionByProjectId
      : {};
  const draftSelectionByProjectId: Record<string, any> = {};
  for (const [k, v] of Object.entries(draftSelectionByProjectIdRaw)) {
    const mappedProjectId = mapProjectId(k);
    if (!mappedProjectId) continue;
    const entryIds = Array.isArray((v as any)?.entryIds) ? (v as any).entryIds.map(mapEntryId).filter(Boolean) : [];
    const factIds = Array.isArray((v as any)?.factIds)
      ? (v as any).factIds.map((id: any) => (typeof id === 'string' ? canonIdMap.get(id) ?? id : undefined)).filter(Boolean)
      : [];
    draftSelectionByProjectId[mappedProjectId] = { entryIds, factIds };
  }

  const draftStyleByProjectIdRaw: Record<string, any> =
    studioRaw.draftStyleByProjectId && typeof studioRaw.draftStyleByProjectId === 'object' ? studioRaw.draftStyleByProjectId : {};
  const draftStyleByProjectId: Record<string, any> = {};
  for (const [k, v] of Object.entries(draftStyleByProjectIdRaw)) {
    const mappedProjectId = mapProjectId(k);
    if (!mappedProjectId) continue;
    const tone = (v as any)?.tone;
    const distance = (v as any)?.distance;
    const targetOutlineItemId = typeof (v as any)?.targetOutlineItemId === 'string' ? (v as any).targetOutlineItemId : undefined;
    draftStyleByProjectId[mappedProjectId] = {
      tone: tone === 'reflective' || tone === 'funny' || tone === 'serious' || tone === 'neutral' ? tone : 'neutral',
      distance: distance === 'expand' || distance === 'invent' || distance === 'close' ? distance : 'close',
      targetOutlineItemId,
    };
  }

  const normalizedNarrative = normalizeNarrativeReferences({
    projects: projects as Record<string, Project>,
    drafts: drafts as Record<string, Draft>,
    draftStyleByProjectId,
  });

  return {
    ...state,
    entries,
    projects: normalizedNarrative.projects,
    drafts: normalizedNarrative.drafts ?? drafts,
    studio: {
      ...studioRaw,
      activeProjectId,
      modeByProjectId,
      draftSelectionByProjectId,
      draftStyleByProjectId: normalizedNarrative.draftStyleByProjectId ?? draftStyleByProjectId,
    },
  };
}

function normalizeHydratedState(state: any): AppState {
  const withIds = ensureUuidIds(state);

  const settingsRaw = withIds?.settings;
  const apiBaseUrlOverride =
    typeof settingsRaw?.apiBaseUrlOverride === 'string' ? settingsRaw.apiBaseUrlOverride : undefined;

  const ashtonModeEnabled = typeof settingsRaw?.ashtonModeEnabled === 'boolean' ? settingsRaw.ashtonModeEnabled : false;
  const ashtonVoiceNotes = typeof settingsRaw?.ashtonVoiceNotes === 'string' ? settingsRaw.ashtonVoiceNotes : '';

  const authRaw = withIds?.auth;
  const authStatus = authRaw?.status === 'signedIn' || authRaw?.status === 'signedOut' || authRaw?.status === 'unknown' ? authRaw.status : 'unknown';
  const userId = typeof authRaw?.userId === 'string' ? authRaw.userId : undefined;
  const email = typeof authRaw?.email === 'string' ? authRaw.email : undefined;

  const profileRaw = withIds?.profile;
  const profileRecordRaw = profileRaw?.record;
  const profileStatus =
    profileRaw?.status === 'idle' || profileRaw?.status === 'loading' || profileRaw?.status === 'ready' || profileRaw?.status === 'error'
      ? profileRaw.status
      : 'idle';
  const profileRecord: UserProfile | undefined =
    profileRecordRaw && typeof profileRecordRaw === 'object' && typeof profileRecordRaw.id === 'string'
      ? {
          id: profileRecordRaw.id,
          email: typeof profileRecordRaw.email === 'string' ? profileRecordRaw.email : undefined,
          displayName:
            typeof profileRecordRaw.displayName === 'string' && profileRecordRaw.displayName.trim()
              ? profileRecordRaw.displayName
              : 'Unnamed user',
          handle: typeof profileRecordRaw.handle === 'string' ? profileRecordRaw.handle : undefined,
          testingLabel: typeof profileRecordRaw.testingLabel === 'string' ? profileRecordRaw.testingLabel : undefined,
          outputVisibility:
            profileRecordRaw.outputVisibility === 'public' || profileRecordRaw.outputVisibility === 'private'
              ? profileRecordRaw.outputVisibility
              : undefined,
          workflowFocus:
            profileRecordRaw.workflowFocus === 'studio' ||
            profileRecordRaw.workflowFocus === 'vault' ||
            profileRecordRaw.workflowFocus === 'projects' ||
            profileRecordRaw.workflowFocus === 'mixed'
              ? profileRecordRaw.workflowFocus
              : undefined,
          createdAt: typeof profileRecordRaw.createdAt === 'number' ? profileRecordRaw.createdAt : undefined,
          updatedAt: typeof profileRecordRaw.updatedAt === 'number' ? profileRecordRaw.updatedAt : undefined,
          lastSeenAt: typeof profileRecordRaw.lastSeenAt === 'number' ? profileRecordRaw.lastSeenAt : undefined,
        }
      : undefined;
  const profileLastError = typeof profileRaw?.lastError === 'string' ? profileRaw.lastError : undefined;

  const syncRaw = withIds?.sync;
  const syncStatus = syncRaw?.status === 'syncing' || syncRaw?.status === 'error' || syncRaw?.status === 'idle' ? syncRaw.status : 'idle';
  const lastSyncAt = typeof syncRaw?.lastSyncAt === 'number' ? syncRaw.lastSyncAt : undefined;
  const lastError = typeof syncRaw?.lastError === 'string' ? syncRaw.lastError : undefined;

  const studioRaw = withIds?.studio;
  const draftSelRaw = studioRaw?.draftSelectionByProjectId;
  const draftSelectionByProjectId: Record<string, { entryIds: string[]; factIds: string[] }> =
    draftSelRaw && typeof draftSelRaw === 'object' ? (draftSelRaw as any) : {};

  const draftStyleRaw = studioRaw?.draftStyleByProjectId;
  const draftStyleByProjectId: Record<string, { tone: any; distance: any; targetOutlineItemId?: string }> =
    draftStyleRaw && typeof draftStyleRaw === 'object' ? (draftStyleRaw as any) : {};

  return {
    ...withIds,
    settings: {
      apiBaseUrlOverride,
      ashtonModeEnabled,
      ashtonVoiceNotes,
    },
    auth: {
      status: authStatus,
      userId,
      email,
    },
    profile: {
      status: profileRecord ? 'ready' : profileStatus,
      record: profileRecord,
      lastError: profileLastError,
    },
    sync: {
      status: syncStatus,
      lastSyncAt,
      lastError,
    },
    studio: {
      ...withIds.studio,
      draftSelectionByProjectId,
      draftStyleByProjectId,
    },
  } as AppState;
}

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'app.hydrate': {
      return normalizeHydratedState(action.payload.state);
    }
    case 'app.replaceRemoteData': {
      const activeProjectId = state.studio.activeProjectId;
      const activeOk = activeProjectId ? Boolean(action.payload.projects[activeProjectId]) : true;
      return {
        ...state,
        entries: action.payload.entries,
        projects: action.payload.projects,
        drafts: action.payload.drafts,
        studio: {
          ...state.studio,
          activeProjectId: activeOk ? activeProjectId : undefined,
        },
      };
    }
    case 'auth.set': {
      return {
        ...state,
        auth: {
          status: 'signedIn',
          userId: action.payload.userId,
          email: action.payload.email,
        },
        sync: {
          ...state.sync,
          status: state.sync.status === 'syncing' ? 'syncing' : 'idle',
          lastError: undefined,
        },
      };
    }
    case 'auth.clear': {
      return {
        ...state,
        auth: {
          status: 'signedOut',
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
          lastSyncAt: state.sync.lastSyncAt,
          lastError: undefined,
        },
      };
    }
    case 'profile.set': {
      const prev = state.profile.record;
      const sameProfile = prev?.id && prev.id === action.payload.record.id;
      return {
        ...state,
        profile: {
          status: 'ready',
          record: sameProfile ? { ...prev, ...action.payload.record } : action.payload.record,
          lastError: undefined,
        },
      };
    }
    case 'profile.clear': {
      return {
        ...state,
        profile: {
          status: 'idle',
          record: undefined,
          lastError: undefined,
        },
      };
    }
    case 'profile.setStatus': {
      return {
        ...state,
        profile: {
          ...state.profile,
          status: action.payload.status,
          lastError: action.payload.lastError,
        },
      };
    }
    case 'sync.set': {
      return {
        ...state,
        sync: {
          status: action.payload.status,
          lastSyncAt: action.payload.lastSyncAt,
          lastError: action.payload.lastError,
        },
      };
    }
    case 'settings.setApiBaseUrlOverride': {
      const raw = action.payload.value;
      const trimmed = typeof raw === 'string' ? raw.trim() : '';
      return {
        ...state,
        settings: {
          ...state.settings,
          apiBaseUrlOverride: trimmed ? trimmed : undefined,
        },
      };
    }
    case 'settings.resetApiBaseUrlOverride': {
      return {
        ...state,
        settings: {
          ...state.settings,
          apiBaseUrlOverride: undefined,
        },
      };
    }
    case 'settings.setAshtonModeEnabled': {
      return {
        ...state,
        settings: {
          ...state.settings,
          ashtonModeEnabled: action.payload.value,
        },
      };
    }
    case 'settings.setAshtonVoiceNotes': {
      return {
        ...state,
        settings: {
          ...state.settings,
          ashtonVoiceNotes: action.payload.value,
        },
      };
    }
    case 'entry.createText': {
      const id = action.payload.entryId ?? makeId('entry');
      const now = Date.now();
      const intent = action.payload.intent?.trim() || '';
      const rawTitle = action.payload.title?.trim() || '';
      const entry: Entry = {
        id,
        title: rawTitle || inferTitleFromText(action.payload.text),
        createdAt: now,
        kind: action.payload.kind ?? 'text',
        status: 'captured',
        intent: intent || undefined,
        targetFormat: action.payload.targetFormat,
        intakeKey: action.payload.intakeKey,
        durationSec:
          action.payload.kind === 'voice'
            ? (action.payload.durationSec ?? (estimateVoiceDurationSecFromTranscript(action.payload.text) || undefined))
            : action.payload.durationSec,
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
    case 'entry.createImportTranscript': {
      const id = action.payload.entryId ?? makeId('entry');
      const now = Date.now();
      const intent = action.payload.intent?.trim() || '';
      const entry: Entry = {
        id,
        title: action.payload.title?.trim() || 'Imported transcript',
        createdAt: now,
        kind: 'import',
        status: 'captured',
        intent: intent || undefined,
        targetFormat: action.payload.targetFormat,
        intakeKey: action.payload.intakeKey,
        transcript: action.payload.transcript,
      };
      return {
        ...state,
        entries: {
          ...state.entries,
          [id]: entry,
        },
      };
    }
    case 'entry.createUpload': {
      const id = action.payload.entryId ?? makeId('entry');
      const now = Date.now();
      const mimeType = action.payload.mimeType;
      const isAudio = typeof mimeType === 'string' && mimeType.startsWith('audio/');

      const entry: Entry = {
        id,
        title: action.payload.title?.trim() || (action.payload.kind === 'video' ? 'Uploaded video' : 'Uploaded file'),
        createdAt: now,
        kind: action.payload.kind,
        status: 'captured',
        audioUri: isAudio ? action.payload.localUri : undefined,
        audioMimeType: isAudio ? mimeType : undefined,
        mediaBucket: action.payload.mediaBucket,
        mediaPath: action.payload.mediaPath,
        mediaFilename: action.payload.filename,
        mediaSizeBytes: action.payload.sizeBytes,
        mediaSha256: action.payload.mediaSha256,
        mediaMimeType: mimeType,
      };

      return {
        ...state,
        entries: {
          ...state.entries,
          [id]: entry,
        },
      };
    }
    case 'entry.createRecording': {
      const id = action.payload.entryId ?? makeId('entry');
      const now = Date.now();
      const rawTitle = action.payload.title?.trim() || '';
      const intent = action.payload.intent?.trim() || '';
      const entry: Entry = {
        id,
        title: rawTitle || makeInstantRecordingTitle({ startedAt: now }),
        createdAt: now,
        kind: 'voice',
        status: 'captured',
        intent: intent || undefined,
        targetFormat: action.payload.targetFormat,
        intakeKey: action.payload.intakeKey,
        durationSec: action.payload.durationSec,
        audioUri: action.payload.audioUri,
        audioMimeType: action.payload.audioMimeType,
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
      const nextTitle = shouldReplaceEntryTitleWithExtraction(entry) ? inferTitleFromExtraction(action.payload) : entry.title;
      return {
        ...state,
        entries: {
          ...state.entries,
          [entry.id]: {
            ...entry,
            title: nextTitle,
            status: 'extracted',
            durationSec:
              entry.kind === 'voice'
                ? (entry.durationSec ?? (estimateVoiceDurationSecFromTranscript(action.payload.transcript) || undefined))
                : entry.durationSec,
            transcript: action.payload.transcript,
            highlights: action.payload.highlights,
            themes: action.payload.themes,
            ideas: action.payload.ideas,
          },
        },
      };
    }
    case 'project.create': {
      const id = action.payload.projectId ?? makeId('proj');
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
                outline: createNarrativeScaffold(action.payload.targetChapterCount ?? deriveTargetPartCount(undefined, undefined)),
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
      const nextState = buildStateWithAddedProjectEntry(state, action.payload);
      if (!nextState) return state;
      return {
        ...state,
        projects: nextState.projects,
        entries: nextState.entries,
      };
    }
    case 'project.setEntries': {
      const nextState = buildStateWithProjectEntries(state, action.payload);
      if (!nextState) return state;
      return {
        ...state,
        projects: nextState.projects,
        entries: nextState.entries,
      };
    }
    case 'draft.create': {
      const id = action.payload.draftId ?? makeId('draft');
      const now = Date.now();
      const format = action.payload.format;
      const tone: Draft['tone'] = action.payload.tone ?? 'neutral';
      const distance: Draft['distance'] = action.payload.distance ?? 'close';

      const project = action.payload.projectId ? state.projects[action.payload.projectId] : undefined;
      const ensuredNarrative = project?.type === 'book'
        ? ensureNarrativeOutlineForDraft({
            project,
            draftsById: state.drafts,
            preferredTargetOutlineItemId: action.payload.targetOutlineItemId,
            draftTitle: action.payload.title,
            draftContent: action.payload.content,
          })
        : undefined;

      const nextTargetOutlineItemId = ensuredNarrative?.targetOutlineItemId ?? action.payload.targetOutlineItemId;
      const nextTitle = action.payload.title?.trim() || (nextTargetOutlineItemId && ensuredNarrative?.outline.find((item) => item.id === nextTargetOutlineItemId)?.title) || 'Draft';

      const draft: Draft = {
        id,
        projectId: action.payload.projectId,
        entryIds: action.payload.entryIds,
        targetOutlineItemId: nextTargetOutlineItemId,
        title: nextTitle,
        createdAt: now,
        format,
        tone,
        distance,
        content: action.payload.content ?? '',
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
        if (!project) return nextState;
        nextState.projects = {
          ...state.projects,
          [project.id]: {
            ...project,
            draftIds: [draft.id, ...project.draftIds],
            book: project.book
              ? {
                  ...project.book,
                  outline: ensuredNarrative?.outline ?? project.book.outline,
                }
              : project.book,
          },
        };
      }

      return nextState;
    }
    case 'draft.update': {
      const draft = state.drafts[action.payload.draftId];
      if (!draft) return state;

      const nextTitle = typeof action.payload.title === 'string' && action.payload.title.trim() ? action.payload.title.trim() : draft.title;

      return {
        ...state,
        drafts: {
          ...state.drafts,
          [draft.id]: {
            ...draft,
            title: nextTitle,
            content: action.payload.content,
            version: draft.version + 1,
          },
        },
      };
    }
    case 'draft.commitSnapshot': {
      const sourceDraft = state.drafts[action.payload.sourceDraftId];
      if (!sourceDraft) return state;

      const id = action.payload.draftId ?? makeId('draft');
      const now = Date.now();
      const nextTitle = typeof action.payload.title === 'string' && action.payload.title.trim() ? action.payload.title.trim() : sourceDraft.title;

      const committedDraft: Draft = {
        ...sourceDraft,
        id,
        title: nextTitle,
        content: action.payload.content ?? sourceDraft.content,
        createdAt: now,
        version: sourceDraft.version + 1,
      };

      const nextState: AppState = {
        ...state,
        drafts: {
          ...state.drafts,
          [id]: committedDraft,
        },
      };

      if (sourceDraft.projectId) {
        const project = state.projects[sourceDraft.projectId];
        if (project) {
          nextState.projects = {
            ...state.projects,
            [project.id]: {
              ...project,
              draftIds: [id, ...project.draftIds.filter((draftId) => draftId !== id)],
            },
          };
        }
      }

      return nextState;
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
    case 'studio.setDraftSelection': {
      return {
        ...state,
        studio: {
          ...state.studio,
          draftSelectionByProjectId: {
            ...state.studio.draftSelectionByProjectId,
            [action.payload.projectId]: {
              entryIds: action.payload.entryIds,
              factIds: action.payload.factIds,
            },
          },
        },
      };
    }
    case 'studio.setDraftStyle': {
      const current = state.studio.draftStyleByProjectId[action.payload.projectId] ?? {
        tone: 'neutral' as const,
        distance: 'close' as const,
        targetOutlineItemId: undefined as string | undefined,
      };
      return {
        ...state,
        studio: {
          ...state.studio,
          draftStyleByProjectId: {
            ...state.studio.draftStyleByProjectId,
            [action.payload.projectId]: {
              tone: action.payload.tone ?? current.tone,
              distance: action.payload.distance ?? current.distance,
              targetOutlineItemId:
                'targetOutlineItemId' in action.payload ? action.payload.targetOutlineItemId : current.targetOutlineItemId,
            },
          },
        },
      };
    }
    case 'book.setBrief': {
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
              brief: {
                premise: action.payload.brief.premise,
                audience: action.payload.brief.audience,
                tone: action.payload.brief.tone,
                constraints: action.payload.brief.constraints,
              },
            },
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
    case 'book.updateCanonCard': {
      const project = state.projects[action.payload.projectId];
      if (!project?.book) return state;
      const updatedAt = Date.now();
      return {
        ...state,
        projects: {
          ...state.projects,
          [project.id]: {
            ...project,
            book: {
              ...project.book,
              canon: project.book.canon.map((card) => {
                if (card.id !== action.payload.canonCardId) return card;
                return {
                  ...card,
                  kind: action.payload.kind ?? card.kind,
                  title: typeof action.payload.title === 'string' && action.payload.title.trim() ? action.payload.title.trim() : card.title,
                  detail: typeof action.payload.detail === 'string' && action.payload.detail.trim() ? action.payload.detail.trim() : card.detail,
                  updatedAt,
                };
              }),
            },
          },
        },
      };
    }
    case 'book.removeCanonCard': {
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
              canon: project.book.canon.filter((card) => card.id !== action.payload.canonCardId),
            },
          },
        },
      };
    }
    case 'book.materializeNarrativeOutline': {
      const project = state.projects[action.payload.projectId];
      if (!project?.book || project.book.outline.length) return state;
      const nextCount = deriveTargetPartCount(project, state.drafts);
      return {
        ...state,
        projects: {
          ...state.projects,
          [project.id]: {
            ...project,
            book: {
              ...project.book,
              outline: createNarrativeScaffold(nextCount),
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
              outline: [...project.book.outline, { id: makeId('ch'), title: action.payload.title, note: action.payload.note?.trim() || undefined, autoGenerated: false }],
            },
          },
        },
      };
    }
    case 'book.updateOutlineItem': {
      const project = state.projects[action.payload.projectId];
      if (!project?.book) return state;
      const nextOutline = project.book.outline.map((o) => {
        if (o.id !== action.payload.outlineItemId) return o;
        const nextTitleRaw = typeof action.payload.title === 'string' ? action.payload.title : o.title;
        const nextTitle = nextTitleRaw.trim() ? nextTitleRaw : 'Untitled';
        const nextNote = typeof action.payload.note === 'string' ? action.payload.note : o.note;
        return { ...o, title: nextTitle, note: nextNote, autoGenerated: false };
      });
      return {
        ...state,
        projects: {
          ...state.projects,
          [project.id]: {
            ...project,
            book: {
              ...project.book,
              outline: nextOutline,
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
  const [hydrated, setHydrated] = useState(false);

  const [authReady, setAuthReady] = useState(false);
  const [bootstrappedUserId, setBootstrappedUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw || cancelled) return;
        const parsed = JSON.parse(raw) as AppState;
        if (!parsed || typeof parsed !== 'object') return;
        dispatch({ type: 'app.hydrate', payload: { state: normalizeHydratedState(parsed) } });
      } catch {
        // ignore
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      dispatch({ type: 'auth.clear' });
      dispatch({ type: 'profile.clear' });
      setAuthReady(true);
      return;
    }

    let mounted = true;

    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error || !data.session?.user) {
          dispatch({ type: 'auth.clear' });
          dispatch({ type: 'profile.clear' });
        } else {
          dispatch({ type: 'auth.set', payload: { userId: data.session.user.id, email: data.session.user.email ?? undefined } });
        }
      } finally {
        if (mounted) setAuthReady(true);
      }
    })();

    const sub = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session?.user) {
        dispatch({ type: 'auth.clear' });
        dispatch({ type: 'profile.clear' });
        return;
      }
      dispatch({ type: 'auth.set', payload: { userId: session.user.id, email: session.user.email ?? undefined } });
    });

    return () => {
      mounted = false;
      sub.data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (state.auth.status === 'signedIn' && state.auth.userId) return;
    setBootstrappedUserId(null);
  }, [state.auth.status, state.auth.userId]);

  useEffect(() => {
    if (!authReady) return;
    if (state.auth.status !== 'signedIn' || !state.auth.userId) {
      dispatch({ type: 'profile.clear' });
      return;
    }

    let cancelled = false;

    (async () => {
      dispatch({ type: 'profile.setStatus', payload: { status: 'loading' } });

      const ensured = await supabaseEnsureMyProfile({ email: state.auth.email });
      if (cancelled) return;
      if (!ensured.ok) {
        dispatch({ type: 'profile.setStatus', payload: { status: 'error', lastError: ensured.error } });
        return;
      }

      const fetched = await supabaseGetMyProfile();
      if (cancelled) return;
      if (!fetched.ok) {
        dispatch({ type: 'profile.setStatus', payload: { status: 'error', lastError: fetched.error } });
        return;
      }

      dispatch({ type: 'profile.set', payload: { record: fetched.profile } });
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, state.auth.email, state.auth.status, state.auth.userId]);

  useEffect(() => {
    if (!hydrated || !authReady) return;
    const userId = state.auth.userId;
    if (state.auth.status !== 'signedIn' || !userId) return;
    if (bootstrappedUserId === userId) return;

    let cancelled = false;

    (async () => {
      const sessionReady = await waitForSupabaseSession(userId);
      if (cancelled) return;
      if (!sessionReady) {
        dispatch({ type: 'sync.set', payload: { status: 'idle', lastSyncAt: state.sync.lastSyncAt, lastError: undefined } });
        return;
      }

      dispatch({ type: 'sync.set', payload: { status: 'syncing', lastSyncAt: state.sync.lastSyncAt, lastError: undefined } });

      const hasAny = await supabaseHasAnyData();
      if (cancelled) return;
      if (!hasAny.ok) {
        dispatch({ type: 'sync.set', payload: { status: 'error', lastSyncAt: state.sync.lastSyncAt, lastError: hasAny.error } });
        return;
      }

      if (!hasAny.hasAny) {
        const pushed = await supabasePushAll({ entries: state.entries, projects: state.projects, drafts: state.drafts });
        if (cancelled) return;
        if (!pushed.ok) {
          dispatch({ type: 'sync.set', payload: { status: 'error', lastSyncAt: state.sync.lastSyncAt, lastError: pushed.error } });
          return;
        }
      } else {
        const pulled = await supabasePullAll();
        if (cancelled) return;
        if (!pulled.ok) {
          dispatch({ type: 'sync.set', payload: { status: 'error', lastSyncAt: state.sync.lastSyncAt, lastError: pulled.error } });
          return;
        }
        dispatch({ type: 'app.replaceRemoteData', payload: { entries: pulled.entries, projects: pulled.projects, drafts: pulled.drafts } });
      }

      dispatch({ type: 'sync.set', payload: { status: 'idle', lastSyncAt: Date.now(), lastError: undefined } });
      setBootstrappedUserId(userId);
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, bootstrappedUserId, hydrated, state.auth.status, state.auth.userId]);

  useEffect(() => {
    if (!hydrated || !authReady) return;
    if (state.auth.status !== 'signedIn' || !state.auth.userId) return;
    if (bootstrappedUserId !== state.auth.userId) return;
    if (state.sync.status === 'syncing') return;

    const t = setTimeout(() => {
      waitForSupabaseSession(state.auth.userId)
        .then((sessionReady) => {
          if (!sessionReady) {
            dispatch({ type: 'sync.set', payload: { status: 'idle', lastSyncAt: state.sync.lastSyncAt, lastError: undefined } });
            return;
          }

          dispatch({ type: 'sync.set', payload: { status: 'syncing', lastSyncAt: state.sync.lastSyncAt, lastError: undefined } });
          return supabasePushAll({ entries: state.entries, projects: state.projects, drafts: state.drafts })
            .then((r) => {
              if (!r.ok) {
                dispatch({ type: 'sync.set', payload: { status: 'error', lastSyncAt: state.sync.lastSyncAt, lastError: r.error } });
                return;
              }
              dispatch({ type: 'sync.set', payload: { status: 'idle', lastSyncAt: Date.now(), lastError: undefined } });
            })
            .catch((e) => {
              dispatch({ type: 'sync.set', payload: { status: 'error', lastSyncAt: state.sync.lastSyncAt, lastError: e?.message || 'Sync failed' } });
            });
        })
        .catch(() => {
          dispatch({ type: 'sync.set', payload: { status: 'idle', lastSyncAt: state.sync.lastSyncAt, lastError: undefined } });
        });
    }, 750);

    return () => clearTimeout(t);
  }, [authReady, bootstrappedUserId, hydrated, state.auth.status, state.auth.userId, state.drafts, state.entries, state.projects]);

  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [hydrated, state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>;
}

export function useAppStore() {
  const ctx = useContext(AppStoreContext);
  if (!ctx) throw new Error('useAppStore must be used within AppStoreProvider');
  return ctx;
}
