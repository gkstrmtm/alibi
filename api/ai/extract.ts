import type { VercelRequest, VercelResponse } from '@vercel/node';

import { badRequest, serverError, setCors, setJson } from '../_lib/http';

type ExtractRequestBody = {
  title?: string;
  transcript?: string;
  intent?: string;
  targetFormat?: 'essay' | 'commentary' | 'podcast-outline' | 'script' | 'thread' | 'book-chapter';
};

type ExtractResult = {
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

  const body = (req.body ?? {}) as ExtractRequestBody;
  const transcript = (body.transcript ?? '').trim();
  if (!transcript) return badRequest(res, 'Missing transcript');

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
    if (!parsed.ok) return serverError(res, `Malformed JSON: ${parsed.error}`);

    const normalized = normalizeExtractResult(parsed.value, transcript);
    if (!normalized.ok) return serverError(res, normalized.error);

    setJson(res);
    res.status(200).json({ ok: true, ...normalized.value });
  } catch (e: any) {
    return serverError(res, e?.message || 'Unknown error');
  }
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
    '  "highlights": string[] (3-8 items, crisp, not generic),',
    '  "themes": string[] (3-6 items, 1-3 words each),',
    '  "ideas": { "title": string, "detail"?: string }[] (3-6 items)',
    '}',
    '',
    'Rules:',
    '- Use ONLY the note. Do not invent facts.',
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
  const highlights = Array.isArray(value?.highlights) ? value.highlights.filter((x: any) => typeof x === 'string').map((s: string) => s.trim()).filter(Boolean) : [];
  const themes = Array.isArray(value?.themes) ? value.themes.filter((x: any) => typeof x === 'string').map((s: string) => s.trim()).filter(Boolean) : [];

  const ideasRaw = Array.isArray(value?.ideas) ? value.ideas : [];
  const ideas = ideasRaw
    .map((i: any) => {
      const title = typeof i?.title === 'string' ? i.title.trim() : '';
      const detail = typeof i?.detail === 'string' ? i.detail.trim() : undefined;
      return title ? { title, detail } : null;
    })
    .filter(Boolean) as Array<{ title: string; detail?: string }>;

  if (!highlights.length) return { ok: false, error: 'Missing highlights' };
  if (!themes.length) return { ok: false, error: 'Missing themes' };
  if (!ideas.length) return { ok: false, error: 'Missing ideas' };

  return {
    ok: true,
    value: {
      transcript: fallbackTranscript,
      highlights: highlights.slice(0, 10),
      themes: themes.slice(0, 10),
      ideas: ideas.slice(0, 10),
    },
  };
}
