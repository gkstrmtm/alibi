import type { AppState, Draft, Entry, Project } from '../store/types';
import { estimateVoiceDurationSecFromTranscript } from '../utils/entryDuration';
import { normalizeNarrativeReferences } from '../utils/outlineIdentity';
import { getSupabaseClient } from './client';

function pairKey(left: string, right: string) {
  return `${left}::${right}`;
}

function toMs(ts: unknown): number {
  if (typeof ts !== 'string' || !ts) return Date.now();
  const n = Date.parse(ts);
  return Number.isFinite(n) ? n : Date.now();
}

export async function supabaseHasAnyData(): Promise<{ ok: true; hasAny: boolean } | { ok: false; error: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase is not configured (missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY)' };

  try {
    const r = await supabase.from('projects').select('id', { count: 'exact', head: true });
    if (r.error) return { ok: false, error: r.error.message };
    return { ok: true, hasAny: (r.count ?? 0) > 0 };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Supabase error' };
  }
}

export async function supabasePullAll(): Promise<
  | { ok: true; entries: Record<string, Entry>; projects: Record<string, Project>; drafts: Record<string, Draft> }
  | { ok: false; error: string }
> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase is not configured (missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY)' };

  try {
    const [{ data: projectsData, error: projectsError }, { data: entriesData, error: entriesError }, { data: draftsData, error: draftsError }] =
      await Promise.all([
        supabase.from('projects').select('*'),
        supabase.from('entries').select('*'),
        supabase.from('drafts').select('*'),
      ]);

    if (projectsError) return { ok: false, error: projectsError.message };
    if (entriesError) return { ok: false, error: entriesError.message };
    if (draftsError) return { ok: false, error: draftsError.message };

    const [{ data: projectEntriesData, error: projectEntriesError }, { data: draftEntriesData, error: draftEntriesError }] =
      await Promise.all([
        supabase.from('project_entries').select('*').order('created_at', { ascending: false }),
        supabase.from('draft_entries').select('*').order('created_at', { ascending: false }),
      ]);

    if (projectEntriesError) return { ok: false, error: projectEntriesError.message };
    if (draftEntriesError) return { ok: false, error: draftEntriesError.message };

    const [{ data: canonData, error: canonError }, { data: outlineData, error: outlineError }] = await Promise.all([
      supabase.from('canon_cards').select('*'),
      supabase.from('outline_items').select('*').order('sort_order', { ascending: true }),
    ]);

    if (canonError) return { ok: false, error: canonError.message };
    if (outlineError) return { ok: false, error: outlineError.message };

    const projectIdByEntryId = new Map<string, string>();
    for (const row of projectEntriesData ?? []) {
      const projectId = String(row.project_id);
      const entryId = String(row.entry_id);
      if (!projectIdByEntryId.has(entryId)) projectIdByEntryId.set(entryId, projectId);
    }

    const entries: Record<string, Entry> = {};
    for (const row of entriesData ?? []) {
      const id = String(row.id);
      entries[id] = {
        id,
        title: String(row.title ?? 'Untitled'),
        createdAt: toMs(row.created_at),
        kind: row.kind,
        status: row.status,
        projectId: projectIdByEntryId.get(id) ?? undefined,
        audioUri: typeof row.audio_uri === 'string' ? row.audio_uri : undefined,
        audioMimeType: typeof row.audio_mime_type === 'string' ? row.audio_mime_type : undefined,
        mediaBucket: typeof row.media_bucket === 'string' ? row.media_bucket : undefined,
        mediaPath: typeof row.media_path === 'string' ? row.media_path : undefined,
        mediaFilename: typeof row.media_filename === 'string' ? row.media_filename : undefined,
        mediaSizeBytes: typeof row.media_size_bytes === 'number' ? row.media_size_bytes : undefined,
        mediaSha256: typeof row.media_sha256 === 'string' ? row.media_sha256 : undefined,
        mediaMimeType: typeof row.media_mime_type === 'string' ? row.media_mime_type : undefined,
        intent: typeof row.intent === 'string' ? row.intent : undefined,
        intakeKey: typeof row.intake_key === 'string' ? row.intake_key : undefined,
        targetFormat: typeof row.target_format === 'string' ? row.target_format : undefined,
        durationSec:
          typeof row.duration_sec === 'number' && row.duration_sec > 0
            ? row.duration_sec
            : row.kind === 'voice' && typeof row.transcript === 'string'
              ? estimateVoiceDurationSecFromTranscript(row.transcript) || undefined
              : undefined,
        transcript: typeof row.transcript === 'string' ? row.transcript : undefined,
        highlights: Array.isArray(row.highlights) ? row.highlights : undefined,
        themes: Array.isArray(row.themes) ? row.themes : undefined,
        ideas: Array.isArray(row.ideas) ? row.ideas : undefined,
      } as Entry;
    }

    const draftEntryIdsByDraftId = new Map<string, string[]>();
    for (const row of draftEntriesData ?? []) {
      const draftId = String(row.draft_id);
      const entryId = String(row.entry_id);
      const list = draftEntryIdsByDraftId.get(draftId) ?? [];
      list.push(entryId);
      draftEntryIdsByDraftId.set(draftId, list);
    }

    const drafts: Record<string, Draft> = {};
    for (const row of draftsData ?? []) {
      const id = String(row.id);
      drafts[id] = {
        id,
        projectId: row.project_id ? String(row.project_id) : undefined,
        entryIds: draftEntryIdsByDraftId.get(id) ?? [],
        targetOutlineItemId: row.target_outline_item_id ? String(row.target_outline_item_id) : undefined,
        title: String(row.title ?? 'Draft'),
        createdAt: toMs(row.created_at),
        format: row.format,
        tone: row.tone,
        distance: row.distance,
        content: String(row.content ?? ''),
        version: typeof row.version === 'number' ? row.version : 1,
      } as Draft;
    }

    const entryIdsByProjectId = new Map<string, string[]>();
    for (const row of projectEntriesData ?? []) {
      const projectId = String(row.project_id);
      const entryId = String(row.entry_id);
      const list = entryIdsByProjectId.get(projectId) ?? [];
      list.push(entryId);
      entryIdsByProjectId.set(projectId, list);
    }

    const canonByProjectId = new Map<string, Array<{ id: string; kind: any; title: string; detail: string; updatedAt: number }>>();
    for (const row of canonData ?? []) {
      const projectId = String(row.project_id);
      const list = canonByProjectId.get(projectId) ?? [];
      list.push({
        id: String(row.id),
        kind: row.kind,
        title: String(row.title ?? ''),
        detail: String(row.detail ?? ''),
        updatedAt: toMs(row.updated_at),
      });
      canonByProjectId.set(projectId, list);
    }

    const outlineByProjectId = new Map<string, Array<{ id: string; title: string; note?: string }>>();
    for (const row of outlineData ?? []) {
      const projectId = String(row.project_id);
      const list = outlineByProjectId.get(projectId) ?? [];
      list.push({
        id: String(row.id),
        title: String(row.title ?? ''),
        note: typeof row.note === 'string' ? row.note : undefined,
      });
      outlineByProjectId.set(projectId, list);
    }

    const draftIdsByProjectId = new Map<string, string[]>();
    for (const d of Object.values(drafts)) {
      if (!d.projectId) continue;
      const list = draftIdsByProjectId.get(d.projectId) ?? [];
      list.push(d.id);
      draftIdsByProjectId.set(d.projectId, list);
    }

    const projects: Record<string, Project> = {};
    for (const row of projectsData ?? []) {
      const id = String(row.id);
      const type = row.type;

      const isBook = type === 'book';
      const brief = row.book_brief && typeof row.book_brief === 'object' ? row.book_brief : null;

      projects[id] = {
        id,
        name: String(row.name ?? 'Untitled project'),
        type,
        createdAt: toMs(row.created_at),
        pinned: Boolean(row.pinned),
        entryIds: entryIdsByProjectId.get(id) ?? [],
        draftIds: draftIdsByProjectId.get(id) ?? [],
        book: isBook
          ? {
              brief: {
                premise: typeof brief?.premise === 'string' ? brief.premise : '',
                audience: typeof brief?.audience === 'string' ? brief.audience : '',
                tone: typeof brief?.tone === 'string' ? brief.tone : '',
                constraints: typeof brief?.constraints === 'string' ? brief.constraints : '',
              },
              canon: canonByProjectId.get(id) ?? [],
              outline: outlineByProjectId.get(id) ?? [],
            }
          : undefined,
      } as Project;
    }

    return { ok: true, entries, projects, drafts };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Supabase error' };
  }
}

export async function supabasePushAll(state: Pick<AppState, 'entries' | 'projects' | 'drafts'>): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase is not configured (missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY)' };

  const session = (await supabase.auth.getSession()).data.session;
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: 'Not signed in' };

  const normalizedNarrative = normalizeNarrativeReferences({
    projects: state.projects as Record<string, Project>,
    drafts: state.drafts as Record<string, Draft>,
  });

  const projects = Object.values(normalizedNarrative.projects);
  const entries = Object.values(state.entries);
  const drafts = Object.values(normalizedNarrative.drafts ?? state.drafts);

  try {
    const projectsRows = projects.map((p) => ({
      id: p.id,
      user_id: userId,
      name: p.name,
      type: p.type,
      pinned: p.pinned,
      book_brief: p.type === 'book' && p.book ? p.book.brief : null,
      book_settings: null,
    }));

    const entriesRows = entries.map((e) => ({
      id: e.id,
      user_id: userId,
      title: e.title,
      kind: e.kind,
      status: e.status,
      intent: e.intent ?? null,
      intake_key: e.intakeKey ?? null,
      target_format: e.targetFormat ?? null,
      duration_sec: e.durationSec ?? null,
      audio_uri: e.audioUri ?? null,
      audio_mime_type: e.audioMimeType ?? null,
      media_bucket: e.mediaBucket ?? null,
      media_path: e.mediaPath ?? null,
      media_filename: e.mediaFilename ?? null,
      media_size_bytes: e.mediaSizeBytes ?? null,
      media_sha256: e.mediaSha256 ?? null,
      media_mime_type: e.mediaMimeType ?? null,
      transcript: e.transcript ?? null,
      highlights: e.highlights ?? null,
      themes: e.themes ?? null,
      ideas: e.ideas ?? null,
    }));

    const draftsRows = drafts.map((d) => ({
      id: d.id,
      user_id: userId,
      project_id: d.projectId ?? null,
      title: d.title,
      format: d.format,
      tone: d.tone,
      distance: d.distance,
      content: d.content,
      version: d.version,
      ...(d.targetOutlineItemId ? { target_outline_item_id: d.targetOutlineItemId } : {}),
    }));

    const projectEntriesRows = projects
      .flatMap((p) => (p.entryIds ?? []).map((entryId) => ({ project_id: p.id, entry_id: entryId, user_id: userId })));

    const draftEntriesRows = drafts
      .flatMap((d) => (d.entryIds ?? []).map((entryId) => ({ draft_id: d.id, entry_id: entryId, user_id: userId })));

    const canonRows = projects.flatMap((p) => {
      if (p.type !== 'book' || !p.book) return [];
      return (p.book.canon ?? []).map((c) => ({
        id: c.id,
        user_id: userId,
        project_id: p.id,
        kind: c.kind,
        title: c.title,
        detail: c.detail,
      }));
    });

    const outlineRows = projects.flatMap((p) => {
      if (p.type !== 'book' || !p.book) return [];
      return (p.book.outline ?? []).map((o, idx) => ({
        id: o.id,
        user_id: userId,
        project_id: p.id,
        title: o.title,
        note: o.note ?? null,
        sort_order: idx,
      }));
    });

    if (projectsRows.length) {
      const r = await supabase.from('projects').upsert(projectsRows, { onConflict: 'id' });
      if (r.error) return { ok: false, error: r.error.message };
    }

    if (entriesRows.length) {
      const r = await supabase.from('entries').upsert(entriesRows, { onConflict: 'id' });
      if (r.error) return { ok: false, error: r.error.message };
    }

    if (draftsRows.length) {
      const r = await supabase.from('drafts').upsert(draftsRows, { onConflict: 'id' });
      if (r.error) return { ok: false, error: r.error.message };
    }

    {
      const projectIds = projects.map((p) => p.id);
      if (projectIds.length) {
        const desiredByProjectId = new Map<string, Set<string>>();
        for (const p of projects) desiredByProjectId.set(p.id, new Set(p.entryIds ?? []));

        const remote = await supabase
          .from('project_entries')
          .select('project_id,entry_id')
          .eq('user_id', userId)
          .in('project_id', projectIds);
        if (remote.error) return { ok: false, error: remote.error.message };

        const remotePairs = new Set<string>();
        const toDeleteByProjectId = new Map<string, string[]>();
        for (const row of remote.data ?? []) {
          const pid = String((row as any).project_id);
          const eid = String((row as any).entry_id);
          remotePairs.add(pairKey(pid, eid));
          const desired = desiredByProjectId.get(pid) ?? new Set<string>();
          if (!desired.has(eid)) {
            const list = toDeleteByProjectId.get(pid) ?? [];
            list.push(eid);
            toDeleteByProjectId.set(pid, list);
          }
        }

        // Delete first so we can safely enforce one-entry→one-project uniqueness.
        for (const [pid, entryIds] of toDeleteByProjectId.entries()) {
          if (!entryIds.length) continue;
          const del = await supabase
            .from('project_entries')
            .delete()
            .eq('user_id', userId)
            .eq('project_id', pid)
            .in('entry_id', entryIds);
          if (del.error) return { ok: false, error: del.error.message };
        }

        const toInsert = projectEntriesRows.filter((row) => !remotePairs.has(pairKey(row.project_id, row.entry_id)));
        if (toInsert.length) {
          const r = await supabase.from('project_entries').insert(toInsert);
          if (r.error) return { ok: false, error: r.error.message };
        }
      }
    }

    {
      const draftIds = drafts.map((d) => d.id);
      if (draftIds.length) {
        const desiredByDraftId = new Map<string, Set<string>>();
        for (const d of drafts) desiredByDraftId.set(d.id, new Set(d.entryIds ?? []));

        const remote = await supabase
          .from('draft_entries')
          .select('draft_id,entry_id')
          .eq('user_id', userId)
          .in('draft_id', draftIds);
        if (remote.error) return { ok: false, error: remote.error.message };

        const remotePairs = new Set<string>();
        const toDeleteByDraftId = new Map<string, string[]>();
        for (const row of remote.data ?? []) {
          const did = String((row as any).draft_id);
          const eid = String((row as any).entry_id);
          remotePairs.add(pairKey(did, eid));
          const desired = desiredByDraftId.get(did) ?? new Set<string>();
          if (!desired.has(eid)) {
            const list = toDeleteByDraftId.get(did) ?? [];
            list.push(eid);
            toDeleteByDraftId.set(did, list);
          }
        }

        const toInsert = draftEntriesRows.filter((row) => !remotePairs.has(pairKey(row.draft_id, row.entry_id)));
        if (toInsert.length) {
          const r = await supabase.from('draft_entries').insert(toInsert);
          if (r.error) return { ok: false, error: r.error.message };
        }

        for (const [did, entryIds] of toDeleteByDraftId.entries()) {
          if (!entryIds.length) continue;
          const del = await supabase
            .from('draft_entries')
            .delete()
            .eq('user_id', userId)
            .eq('draft_id', did)
            .in('entry_id', entryIds);
          if (del.error) return { ok: false, error: del.error.message };
        }
      }
    }

    if (canonRows.length) {
      const r = await supabase.from('canon_cards').upsert(canonRows, { onConflict: 'id' });
      if (r.error) return { ok: false, error: r.error.message };
    }

    if (outlineRows.length) {
      const r = await supabase.from('outline_items').upsert(outlineRows, { onConflict: 'id' });
      if (r.error) return { ok: false, error: r.error.message };
    }

    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Supabase error' };
  }
}
