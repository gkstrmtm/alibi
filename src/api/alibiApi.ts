import { getApiBaseUrl } from '../config/env';

type GenerateDraftInput = {
  projectName: string;
  format: 'essay' | 'commentary' | 'podcast-outline' | 'script' | 'thread' | 'book-chapter';
  sources: Array<{ title?: string; transcript?: string; highlights?: string[] }>;
  canon: Array<{ kind?: string; title?: string; detail?: string }>;
};

type ExtractEntryInput = {
  title?: string;
  transcript: string;
  intent?: string;
  targetFormat?: GenerateDraftInput['format'];
};

export async function generateDraft(input: GenerateDraftInput): Promise<{ ok: true; content: string } | { ok: false; error: string }> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return { ok: false, error: 'Missing EXPO_PUBLIC_API_BASE_URL' };

  try {
    const r = await fetch(`${baseUrl}/api/ai/draft`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });

    const data = (await r.json()) as any;
    if (!r.ok || !data?.ok) {
      const msg = typeof data?.error === 'string' ? data.error : `Request failed (${r.status})`;
      return { ok: false, error: msg };
    }

    if (typeof data.content !== 'string') return { ok: false, error: 'Malformed response' };
    return { ok: true, content: data.content };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error' };
  }
}

export async function extractEntry(
  input: ExtractEntryInput,
): Promise<
  | { ok: true; transcript: string; highlights: string[]; themes: string[]; ideas: Array<{ title: string; detail?: string }> }
  | { ok: false; error: string }
> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return { ok: false, error: 'Missing EXPO_PUBLIC_API_BASE_URL' };

  try {
    const r = await fetch(`${baseUrl}/api/ai/extract`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });

    const data = (await r.json()) as any;
    if (!r.ok || !data?.ok) {
      const msg = typeof data?.error === 'string' ? data.error : `Request failed (${r.status})`;
      return { ok: false, error: msg };
    }

    if (typeof data.transcript !== 'string') return { ok: false, error: 'Malformed response' };
    if (!Array.isArray(data.highlights) || !Array.isArray(data.themes) || !Array.isArray(data.ideas)) {
      return { ok: false, error: 'Malformed response' };
    }

    return {
      ok: true,
      transcript: data.transcript,
      highlights: data.highlights,
      themes: data.themes,
      ideas: data.ideas,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error' };
  }
}
