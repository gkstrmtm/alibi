import { getApiBaseUrl, normalizeBaseUrl } from '../config/env';

type GenerateDraftInput = {
  projectName: string;
  format: 'essay' | 'commentary' | 'podcast-outline' | 'script' | 'thread' | 'book-chapter';
  brief?: {
    premise?: string;
    audience?: string;
    tone?: string;
    constraints?: string;
  };
  tone?: 'neutral' | 'reflective' | 'funny' | 'serious';
  distance?: 'close' | 'expand' | 'invent';
  target?: { title?: string; note?: string };
  sources: Array<{ title?: string; transcript?: string; highlights?: string[] }>;
  canon: Array<{ kind?: string; title?: string; detail?: string }>;
  continuity?: {
    summary?: string;
    lockedFacts?: Array<{ kind?: string; title?: string; detail?: string }>;
    target?: { title?: string; note?: string; index?: number; total?: number; beforeTitle?: string; afterTitle?: string };
    priorPasses?: Array<{ title?: string; targetTitle?: string; summary?: string }>;
    driftRisks?: string[];
  };
  voice?: { enabled?: boolean; notes?: string };
};

type ReviseDraftInput = {
  projectName: string;
  format: GenerateDraftInput['format'];
  draftTitle?: string;
  currentDraft: string;
  target?: { scope?: 'full' | 'section'; heading?: string; content?: string };
  instruction: string;
  brief?: GenerateDraftInput['brief'];
  tone?: GenerateDraftInput['tone'];
  distance?: GenerateDraftInput['distance'];
  sources: GenerateDraftInput['sources'];
  canon: GenerateDraftInput['canon'];
  continuity?: GenerateDraftInput['continuity'];
  voice?: { enabled?: boolean; notes?: string };
};

type ExtractEntryInput = {
  title?: string;
  transcript?: string;
  intent?: string;
  targetFormat?: GenerateDraftInput['format'];
  voice?: { enabled?: boolean; notes?: string };
  audio?: { base64: string; mimeType?: string; filename?: string };
};

type ApiOptions = { baseUrl?: string };

export type ReadbackAudioResult =
  | { ok: true; audioBase64: string; mimeType: string; provider?: string; voiceId?: string }
  | { ok: false; error: string };

export type LiveSignalKind = 'takeaway' | 'theme' | 'question' | 'direction';

export type LiveSessionSignal = {
  kind: LiveSignalKind;
  text: string;
  confidence: 'low' | 'medium' | 'high';
  questionCategory?: 'clarifying' | 'expanding' | 'structural';
  advancesProjectBy?: string;
};

type LiveSessionInput = {
  recentTranscript: string;
  runningSummary?: string;
  recentTakeaways?: string[];
  priorSignals?: Array<{ kind?: LiveSignalKind; text?: string }>;
  objective?: string;
  mode?: 'free-think' | 'project' | 'book' | 'other';
  questioningMode?: 'listen' | 'clarify' | 'probe' | 'land';
  detectedLane?: {
    label: string;
    supportingPhrases?: string[];
    stability?: number;
  };
  interviewState?: {
    coveredDimensions?: string[];
    missingDimensions?: string[];
    recommendedFocus?: string;
  };
  projectContext?: {
    recentTitle?: string;
    themes?: string[];
    highlights?: string[];
    premise?: string;
    outlineSteps?: string[];
    canon?: string[];
    currentDraftTitle?: string;
    latestDraftTitle?: string;
  };
  questionPlan?: {
    category: 'clarifying' | 'expanding' | 'structural';
    goal: string;
    rationale?: string;
  };
};

function resolveBaseUrl(opts?: ApiOptions): string {
  const override = normalizeBaseUrl(opts?.baseUrl);
  return override || getApiBaseUrl();
}

async function readApiPayload(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';

  if (contentType.includes('application/json')) {
    return response.json().catch(() => null);
  }

  const text = await response.text().catch(() => '');
  return { rawText: text };
}

function buildApiError(response: Response, data: any) {
  const explicit = typeof data?.error === 'string'
    ? data.error
    : typeof data?.message === 'string'
      ? data.message
      : typeof data?.rawText === 'string' && data.rawText.trim()
        ? data.rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)
        : '';

  if (explicit) return explicit;
  if (response.status === 403) return 'Request refused (403). Check API deployment, project access, or server configuration.';
  return `Request failed (${response.status})`;
}

export async function generateDraft(
  input: GenerateDraftInput,
  opts?: ApiOptions,
): Promise<{ ok: true; content: string } | { ok: false; error: string }> {
  const baseUrl = resolveBaseUrl(opts);
  if (!baseUrl) return { ok: false, error: 'Missing API base URL (set EXPO_PUBLIC_API_BASE_URL or configure it in Profile → Settings → API Connection)' };

  try {
    const r = await fetch(`${baseUrl}/api/ai/draft`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });

    const data = await readApiPayload(r);
    if (!r.ok || !data?.ok) {
      const msg = buildApiError(r, data);
      return { ok: false, error: msg };
    }

    if (typeof data.content !== 'string') return { ok: false, error: 'Malformed response' };
    return { ok: true, content: data.content };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error' };
  }
}

export async function reviseDraft(
  input: ReviseDraftInput,
  opts?: ApiOptions,
): Promise<{ ok: true; content: string } | { ok: false; error: string }> {
  const baseUrl = resolveBaseUrl(opts);
  if (!baseUrl) return { ok: false, error: 'Missing API base URL (set EXPO_PUBLIC_API_BASE_URL or configure it in Profile → Settings → API Connection)' };

  try {
    const r = await fetch(`${baseUrl}/api/ai/revise-draft`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });

    const data = await readApiPayload(r);
    if (!r.ok || !data?.ok) {
      const msg = buildApiError(r, data);
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
  opts?: ApiOptions,
): Promise<
  | { ok: true; title?: string; transcript: string; highlights: string[]; themes: string[]; ideas: Array<{ title: string; detail?: string }> }
  | { ok: false; error: string }
> {
  const baseUrl = resolveBaseUrl(opts);
  if (!baseUrl) return { ok: false, error: 'Missing API base URL (set EXPO_PUBLIC_API_BASE_URL or configure it in Profile → Settings → API Connection)' };

  try {
    const r = await fetch(`${baseUrl}/api/ai/extract`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });

    const data = await readApiPayload(r);
    if (!r.ok || !data?.ok) {
      const msg = buildApiError(r, data);
      return { ok: false, error: msg };
    }

    if (typeof data.transcript !== 'string') return { ok: false, error: 'Malformed response' };
    if (!Array.isArray(data.highlights) || !Array.isArray(data.themes) || !Array.isArray(data.ideas)) {
      return { ok: false, error: 'Malformed response' };
    }

    return {
      ok: true,
      title: typeof data.title === 'string' ? data.title : undefined,
      transcript: data.transcript,
      highlights: data.highlights,
      themes: data.themes,
      ideas: data.ideas,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error' };
  }
}

export async function analyzeLiveSession(
  input: LiveSessionInput,
  opts?: ApiOptions,
): Promise<
  | { ok: true; summary: string; signal: LiveSessionSignal; takeaways: string[] }
  | { ok: false; error: string }
> {
  const baseUrl = resolveBaseUrl(opts);
  if (!baseUrl) return { ok: false, error: 'Missing API base URL (set EXPO_PUBLIC_API_BASE_URL or configure it in Profile → Settings → API Connection)' };

  try {
    const r = await fetch(`${baseUrl}/api/ai/live-session-signal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });

    const data = await readApiPayload(r);
    if (!r.ok || !data?.ok) {
      const msg = buildApiError(r, data);
      return { ok: false, error: msg };
    }

    if (typeof data.summary !== 'string') return { ok: false, error: 'Malformed response' };
    if (typeof data?.signal?.text !== 'string' || typeof data?.signal?.kind !== 'string') {
      return { ok: false, error: 'Malformed response' };
    }

    return {
      ok: true,
      summary: data.summary,
      signal: {
        kind: data.signal.kind,
        text: data.signal.text,
        confidence: data.signal.confidence,
        questionCategory: typeof data?.signal?.questionCategory === 'string' ? data.signal.questionCategory : undefined,
        advancesProjectBy: typeof data?.signal?.advancesProjectBy === 'string' ? data.signal.advancesProjectBy : undefined,
      },
      takeaways: Array.isArray(data.takeaways) ? data.takeaways.filter((x: any) => typeof x === 'string') : [],
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error' };
  }
}

export async function generateReadbackAudio(
  input: { text: string },
  opts?: ApiOptions,
): Promise<ReadbackAudioResult> {
  const baseUrl = resolveBaseUrl(opts);
  if (!baseUrl) return { ok: false, error: 'Missing API base URL (set EXPO_PUBLIC_API_BASE_URL or configure it in Profile → Settings → API Connection)' };

  try {
    const r = await fetch(`${baseUrl}/api/ai/readback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });

    const data = await readApiPayload(r);
    if (!r.ok || !data?.ok) {
      const msg = buildApiError(r, data);
      return { ok: false, error: msg };
    }

    if (typeof data.audioBase64 !== 'string' || typeof data.mimeType !== 'string') {
      return { ok: false, error: 'Malformed response' };
    }

    return {
      ok: true,
      audioBase64: data.audioBase64,
      mimeType: data.mimeType,
      provider: typeof data.provider === 'string' ? data.provider : undefined,
      voiceId: typeof data.voiceId === 'string' ? data.voiceId : undefined,
    };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Network error' };
  }
}
