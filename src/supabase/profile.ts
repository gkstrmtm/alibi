import { getSupabaseClient } from './client';
import type { UserProfile } from '../store/types';

function toMs(ts: unknown): number | undefined {
  if (typeof ts !== 'string' || !ts) return undefined;
  const n = Date.parse(ts);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeHandle(raw: string | undefined): string | undefined {
  const value = (raw ?? '').trim().toLowerCase();
  if (!value) return undefined;
  const normalized = value.replace(/[^a-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return normalized || undefined;
}

function buildProfile(row: any): UserProfile {
  return {
    id: String(row.id),
    email: typeof row.email === 'string' ? row.email : undefined,
    displayName: typeof row.display_name === 'string' && row.display_name.trim() ? row.display_name.trim() : 'Unnamed user',
    handle: typeof row.handle === 'string' && row.handle.trim() ? row.handle.trim() : undefined,
    testingLabel: typeof row.testing_label === 'string' && row.testing_label.trim() ? row.testing_label.trim() : undefined,
    outputVisibility: row.output_visibility === 'public' || row.output_visibility === 'private' ? row.output_visibility : undefined,
    workflowFocus:
      row.workflow_focus === 'studio' || row.workflow_focus === 'vault' || row.workflow_focus === 'projects' || row.workflow_focus === 'mixed'
        ? row.workflow_focus
        : undefined,
    createdAt: toMs(row.created_at),
    updatedAt: toMs(row.updated_at),
    lastSeenAt: toMs(row.last_seen_at),
  };
}

export async function supabaseEnsureMyProfile(input?: {
  email?: string;
  displayName?: string;
  handle?: string;
  testingLabel?: string;
  outputVisibility?: 'private' | 'public';
  workflowFocus?: 'studio' | 'vault' | 'projects' | 'mixed';
}): Promise<{ ok: true; profile: UserProfile } | { ok: false; error: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase not configured' };

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) return { ok: false, error: sessionError.message };
  const user = sessionData.session?.user;
  if (!user) return { ok: false, error: 'Not signed in' };

  const payload = {
    id: user.id,
    email: input?.email?.trim() || user.email || null,
    display_name: input?.displayName?.trim() || (typeof user.user_metadata?.display_name === 'string' ? user.user_metadata.display_name.trim() : '') || null,
    handle: normalizeHandle(input?.handle || (typeof user.user_metadata?.handle === 'string' ? user.user_metadata.handle : '')) || null,
    testing_label: input?.testingLabel?.trim() || null,
    output_visibility: input?.outputVisibility ?? null,
    workflow_focus: input?.workflowFocus ?? null,
    last_seen_at: new Date().toISOString(),
  };

  const upsert = await supabase
    .from('profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (upsert.error) return { ok: false, error: upsert.error.message };
  return { ok: true, profile: buildProfile(upsert.data) };
}

export async function supabaseGetMyProfile(): Promise<{ ok: true; profile: UserProfile } | { ok: false; error: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase not configured' };

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) return { ok: false, error: sessionError.message };
  const user = sessionData.session?.user;
  if (!user) return { ok: false, error: 'Not signed in' };

  const query = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (query.error) return { ok: false, error: query.error.message };
  if (!query.data) return supabaseEnsureMyProfile({ email: user.email });

  return { ok: true, profile: buildProfile(query.data) };
}

export async function supabaseUpdateMyProfile(input: {
  displayName: string;
  handle?: string;
  testingLabel?: string;
  outputVisibility?: 'private' | 'public';
  workflowFocus?: 'studio' | 'vault' | 'projects' | 'mixed';
}): Promise<{ ok: true; profile: UserProfile } | { ok: false; error: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, error: 'Supabase not configured' };

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) return { ok: false, error: sessionError.message };
  const user = sessionData.session?.user;
  if (!user) return { ok: false, error: 'Not signed in' };

  const update = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        email: user.email || null,
        display_name: input.displayName.trim() || 'Unnamed user',
        handle: normalizeHandle(input.handle) || null,
        testing_label: input.testingLabel?.trim() || null,
        output_visibility: input.outputVisibility ?? null,
        workflow_focus: input.workflowFocus ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )
    .select('*')
    .single();

  if (update.error) return { ok: false, error: update.error.message };
  return { ok: true, profile: buildProfile(update.data) };
}
