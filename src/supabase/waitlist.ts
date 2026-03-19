import { Platform } from 'react-native';

import { getSupabaseClient } from './client';

export type WaitlistRole = 'creator' | 'writer' | 'founder' | 'thinker' | 'other';

export async function submitWaitlistLead(input: {
  email: string;
  role?: WaitlistRole;
  useCase?: string;
  betaOptIn?: boolean;
  source?: string;
}): Promise<{ ok: true; duplicate?: boolean } | { ok: false; error: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      error: 'Waitlist storage is not configured yet. Add the public Supabase env vars and apply the schema update before launch.',
    };
  }

  const email = input.email.trim().toLowerCase();
  const role = input.role ?? null;
  const useCase = input.useCase?.trim() ? input.useCase.trim().slice(0, 800) : null;

  try {
    const { error } = await supabase.from('waitlist_leads').insert({
      email,
      role,
      use_case: useCase,
      beta_opt_in: input.betaOptIn ?? true,
      source: input.source?.trim() || 'prelaunch-app',
      metadata: {
        platform: Platform.OS,
        captured_at: new Date().toISOString(),
      },
    });

    if (!error) return { ok: true };

    if (error.code === '23505' || /duplicate key|already exists/i.test(error.message)) {
      return { ok: true, duplicate: true };
    }

    return { ok: false, error: error.message };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'Could not save waitlist signup.' };
  }
}