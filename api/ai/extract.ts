import type { VercelRequest, VercelResponse } from '@vercel/node';

import { badRequest, serverError, setCors, setJson } from '../_lib/http';

type ExtractRequestBody = {
  title?: string;
  transcript?: string;
  intent?: string;
  targetFormat?: 'essay' | 'commentary' | 'podcast-outline' | 'script' | 'thread' | 'book-chapter';
  voice?: { enabled?: boolean; notes?: string };
  audio?: { base64?: string; mimeType?: string; filename?: string };
};

type ExtractResult = {
  title: string;
  transcript: string;
  highlights: string[];
  themes: string[];
  ideas: Array<{ title: string; detail?: string }>;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    setJson(res);
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return serverError(res, 'Missing OPENAI_API_KEY');

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const transcribeModel = process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe';

  const body = (req.body ?? {}) as ExtractRequestBody;
  let transcript = (body.transcript ?? '').trim();

  if (!transcript) {
    const audioBase64 = (body.audio?.base64 ?? '').trim();
    if (!audioBase64) return badRequest(res, 'Missing transcript or audio');

    try {
      transcript = await transcribeAudio({
        apiKey,
        model: transcribeModel,
        base64: audioBase64,
        mimeType: body.audio?.mimeType,
        filename: body.audio?.filename,
      });
    } catch (e: any) {
      return serverError(res, e?.message || 'Transcription failed');
    }

    if (!transcript) return serverError(res, 'Transcription returned empty text');
  }

  const title = (body.title ?? '').trim();
  const intent = (body.intent ?? '').trim();
  const targetFormat = body.targetFormat;

  const prompt = buildPrompt({ title, transcript, intent, targetFormat });

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content:
              'You are Alibi. You extract structure from raw notes. Output MUST be valid JSON only. No markdown, no backticks, no commentary.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!r.ok) {
      const text = await r.text();
      return serverError(res, `OpenAI error (${r.status}): ${text.slice(0, 800)}`);
    }

    const data = (await r.json()) as any;
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      return serverError(res, 'OpenAI response missing content');
    }

    const parsed = safeParseJsonObject(content);
    if (!parsed.ok) return serverError(res, `Malformed JSON: ${(parsed as any).error}`);

    const normalized = normalizeExtractResult(parsed.value, transcript);
    if (!normalized.ok) return serverError(res, (normalized as any).error);

    setJson(res);
    res.status(200).json({ ok: true, ...normalized.value });
  } catch (e: any) {
    return serverError(res, e?.message || 'Unknown error');
  }
}

async function transcribeAudio({
  apiKey,
  model,
  base64,
  mimeType,
  filename,
}: {
  apiKey: string;
  model: string;
  base64: string;
  mimeType?: string;
  filename?: string;
}): Promise<string> {
  // Strip data URL prefix if present.
  const cleaned = base64.includes('base64,') ? base64.slice(base64.indexOf('base64,') + 'base64,'.length) : base64;
  const buf = Buffer.from(cleaned, 'base64');
  if (!buf.length) throw new Error('Empty audio payload');

  // Node 18+/20+ provides FormData + Blob globally in Vercel runtimes.
  const form = new FormData();
  const blob = new Blob([buf], { type: mimeType || 'application/octet-stream' });
  form.append('file', blob, filename || 'recording.m4a');
  form.append('model', model);

  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
    body: form as any,
  });

  if (!r.ok) {
    const text = await r.text();
    throw new Error(`OpenAI transcribe error (${r.status}): ${text.slice(0, 800)}`);
  }

  const data = (await r.json()) as any;
  const text: unknown = data?.text;
  if (typeof text !== 'string') throw new Error('OpenAI transcribe response missing text');
  return text.trim();
}

function buildPrompt({
  title,
  transcript,
  intent,
  targetFormat,
}: {
  title: string;
  transcript: string;
  intent: string;
  targetFormat?: string;
}) {
  const ctx = [
    title ? `Title: ${title}` : '',
    intent ? `Intent (user): ${intent}` : '',
    targetFormat ? `Target output format (user): ${targetFormat}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return [
    ctx,
    ctx ? '' : '',
    'Task: Extract structure from the raw note below.',
    '',
    'Return JSON with this exact shape:',
    '{',
    '  "title": string (2-6 words, specific, human, useful as an entry title),',
    '  "highlights": string[] (4-8 items, specific, concrete, preserving tension, stakes, turns, or memorable detail),',
    '  "themes": string[] (3-6 items, 1-4 words each, repeated forces or concerns rather than isolated nouns),',
    '  "ideas": { "title": string, "detail"?: string }[] (3-6 items, each worth developing further)',
    '}',
    '',
    'Rules:',
    '- Use ONLY the note. Do not invent facts.',
    '- Do not hide specificity behind vague language. Prefer the actual pressure, conflict, fear, claim, artifact, or scene.',
    '- A single passing word is not automatically a theme.',
    '- If a detail sounds unresolved, preserve that uncertainty instead of flattening it.',
    '- Do NOT include # or markdown formatting in the title.',
      '- Do NOT include # or markdown formatting in the title.',
      '- Titles should feel memorable, not generic.',
    '- If something is uncertain, phrase it as a hypothesis in an idea detail.',
    '- Keep ideas actionable (what could be developed into writing).',
    '',
    'Raw note:',
    transcript,
  ]
    .filter(Boolean)
    .join('\n');
}

function safeParseJsonObject(text: string): { ok: true; value: any } | { ok: false; error: string } {
  const trimmed = text.trim();

  // Best case: it's already pure JSON.
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch {
    // continue
  }

  // Otherwise, try to extract the first top-level JSON object.
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return { ok: false, error: 'No JSON object found' };
  }

  const slice = trimmed.slice(firstBrace, lastBrace + 1);
  try {
    return { ok: true, value: JSON.parse(slice) };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'JSON parse failed' };
  }
}

function normalizeExtractResult(value: any, fallbackTranscript: string): { ok: true; value: ExtractResult } | { ok: false; error: string } {
  const transcriptWordCount = countWords(fallbackTranscript);
  const isThin = transcriptWordCount < 45;
  const title = normalizeTitle(value?.title, fallbackTranscript);
  const highlightsRaw = Array.isArray(value?.highlights) ? value.highlights.filter((x: any) => typeof x === 'string').map((s: string) => s.trim()).filter(Boolean) : [];
  const themesRaw = Array.isArray(value?.themes) ? value.themes.filter((x: any) => typeof x === 'string').map((s: string) => s.trim()).filter(Boolean) : [];

  const ideasRaw = Array.isArray(value?.ideas) ? value.ideas : [];
  const parsedIdeas = ideasRaw
    .map((i: any) => {
      const title = typeof i?.title === 'string' ? i.title.trim() : '';
      const detail = typeof i?.detail === 'string' ? i.detail.trim() : undefined;
      return title ? { title, detail } : null;
    })
    .filter(Boolean) as Array<{ title: string; detail?: string }>;

  const fallbackHighlightSeed = fallbackHighlights(fallbackTranscript);
  const highlights = normalizeHighlights(highlightsRaw.length ? highlightsRaw : fallbackHighlightSeed, fallbackHighlightSeed).slice(0, isThin ? 3 : 8);
  const fallbackThemeSeed = fallbackThemes(fallbackTranscript, highlights);
  const themes = normalizeThemes(themesRaw.length ? themesRaw : fallbackThemeSeed, fallbackTranscript, highlights).slice(0, isThin ? 2 : 6);
  const ideas = normalizeIdeas(parsedIdeas.length ? parsedIdeas : fallbackIdeas(highlights, themes)).slice(0, isThin ? 2 : 6);

  if (!highlights.length) return { ok: false, error: 'Missing highlights' };
  if (!themes.length) return { ok: false, error: 'Missing themes' };
  if (!ideas.length) return { ok: false, error: 'Missing ideas' };

  return {
    ok: true,
    value: {
      title,
      transcript: fallbackTranscript,
      highlights,
      themes,
      ideas,
    },
  };
}

const GENERIC_THEME_TERMS = new Set([
  'idea',
  'ideas',
  'thought',
  'thoughts',
  'story',
  'stories',
  'note',
  'notes',
  'life',
  'feeling',
  'feelings',
  'reflection',
  'reflections',
  'experience',
  'experiences',
  'project',
  'projects',
  'thing',
  'things',
]);

function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const item of items) {
    const normalized = item.toLowerCase().replace(/[^a-z0-9\s'-]+/gi, '').replace(/\s+/g, ' ').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    next.push(item.trim());
  }

  return next;
}

function normalizeHighlights(items: string[], fallbackItems: string[]): string[] {
  const cleaned = uniqueStrings(
    items
      .map((item) => truncateOneLine(item, 140))
      .filter((item) => item.length >= 18),
  );

  if (cleaned.length >= 4) return cleaned;

  return uniqueStrings([...cleaned, ...fallbackItems.map((item) => truncateOneLine(item, 140)).filter((item) => item.length >= 18)]);
}

function deriveThemeCandidates(transcript: string, highlights: string[]): string[] {
  const source = `${highlights.join(' ')} ${transcript}`.toLowerCase();
  const words = source.match(/[a-z][a-z'-]{3,}/gi) ?? [];
  const filtered = words.filter((word) => !GENERIC_THEME_TERMS.has(word));
  const counts = new Map<string, number>();

  for (let i = 0; i < filtered.length; i += 1) {
    const one = filtered[i];
    if (!one) continue;
    counts.set(one, (counts.get(one) ?? 0) + 1);

    const two = filtered[i + 1];
    if (two && !GENERIC_THEME_TERMS.has(two)) {
      const bigram = `${one} ${two}`;
      counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([phrase]) => phrase)
    .filter((phrase) => {
      const parts = phrase.split(/\s+/).filter(Boolean);
      if (!parts.length || parts.length > 4) return false;
      if (parts.every((part) => GENERIC_THEME_TERMS.has(part))) return false;
      return true;
    })
    .map((phrase) => phrase.split(/\s+/).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' '));
}

function normalizeThemes(items: string[], transcript: string, highlights: string[]): string[] {
  const cleaned = uniqueStrings(
    items
      .map((item) => item.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .filter((item) => {
        const normalized = item.toLowerCase();
        const parts = normalized.split(/\s+/).filter(Boolean);
        if (!parts.length || parts.length > 4) return false;
        if (parts.every((part) => GENERIC_THEME_TERMS.has(part))) return false;
        return true;
      }),
  );

  const derived = deriveThemeCandidates(transcript, highlights);
  return uniqueStrings([...cleaned, ...derived]);
}

function normalizeIdeas(items: Array<{ title: string; detail?: string }>): Array<{ title: string; detail?: string }> {
  const seen = new Set<string>();
  const next: Array<{ title: string; detail?: string }> = [];

  for (const item of items) {
    const title = truncateOneLine(item.title, 72);
    const key = title.toLowerCase();
    if (!title || seen.has(key)) continue;
    seen.add(key);
    next.push({
      title,
      detail: item.detail ? truncateOneLine(item.detail, 160) : undefined,
    });
  }

  return next;
}

function truncateOneLine(raw: string, maxLen: number): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, Math.max(0, maxLen - 1)).trimEnd() + '…';
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function transcriptLines(transcript: string): string[] {
  return transcript
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function normalizeTitle(raw: unknown, transcript: string): string {
  if (typeof raw === 'string' && raw.trim()) return truncateOneLine(raw, 56);
  const first = transcriptLines(transcript)[0] ?? transcript;
  return truncateOneLine(first, 56) || 'Captured thought';
}

function fallbackHighlights(transcript: string): string[] {
  return transcriptLines(transcript)
    .slice(0, 4)
    .map((line) => truncateOneLine(line, 120))
    .filter(Boolean);
}

function fallbackThemes(transcript: string, highlights: string[]): string[] {
  const seed = (highlights[0] ?? transcriptLines(transcript)[0] ?? '').toLowerCase();
  const words = seed.match(/[a-z][a-z'-]{3,}/gi) ?? [];
  const unique = Array.from(new Set(words.map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)));
  return unique.slice(0, 4).length ? unique.slice(0, 4) : ['Captured thought'];
}

function fallbackIdeas(highlights: string[], themes: string[]): Array<{ title: string; detail?: string }> {
  const seeds = highlights.slice(0, 3);
  if (!seeds.length) return themes.slice(0, 3).map((theme) => ({ title: `Develop ${theme}` }));
  return seeds.map((highlight, index) => ({
    title: truncateOneLine(highlight, 48),
    detail: themes[index] ? `Develop this around ${themes[index]}.` : undefined,
  }));
}
