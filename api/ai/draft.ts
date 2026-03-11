import type { VercelRequest, VercelResponse } from '@vercel/node';

import { badRequest, serverError, setCors, setJson } from '../_lib/http';

type DraftRequestBody = {
  projectName?: string;
  format?: 'essay' | 'commentary' | 'podcast-outline' | 'script' | 'thread' | 'book-chapter';
  sources?: Array<{ title?: string; transcript?: string; highlights?: string[] }>;
  canon?: Array<{ kind?: string; title?: string; detail?: string }>;
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

  const body = (req.body ?? {}) as DraftRequestBody;
  const format = body.format ?? 'essay';

  const sources = Array.isArray(body.sources) ? body.sources.slice(0, 12) : [];
  const canon = Array.isArray(body.canon) ? body.canon.slice(0, 24) : [];

  const hasAnyText =
    sources.some((s) => (s.transcript && s.transcript.trim().length) || (s.highlights && s.highlights.length)) ||
    canon.some((c) => (c.title && c.title.trim().length) || (c.detail && c.detail.trim().length));

  if (!hasAnyText) {
    return badRequest(res, 'No sources/canon provided');
  }

  const projectName = body.projectName?.trim() || 'Untitled project';

  const prompt = buildPrompt({ projectName, format, sources, canon });

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        messages: [
          {
            role: 'system',
            content:
              'You are Alibi, a private-first creative studio. Write clean, specific prose. Do not mention policies or that you are an AI. Do not invent facts beyond the provided sources and canon; if something is unclear, phrase it as a question or as a hypothesis.',
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

    setJson(res);
    res.status(200).json({ ok: true, content: content.trim() });
  } catch (e: any) {
    return serverError(res, e?.message || 'Unknown error');
  }
}

function buildPrompt({
  projectName,
  format,
  sources,
  canon,
}: {
  projectName: string;
  format: string;
  sources: Array<{ title?: string; transcript?: string; highlights?: string[] }>;
  canon: Array<{ kind?: string; title?: string; detail?: string }>;
}) {
  const canonText = canon
    .map((c) => {
      const k = c.kind ? `[${c.kind}] ` : '';
      const t = c.title?.trim() ? c.title.trim() : 'Untitled';
      const d = c.detail?.trim() ? c.detail.trim() : '';
      return `- ${k}${t}${d ? `: ${d}` : ''}`;
    })
    .join('\n');

  const sourceText = sources
    .map((s, idx) => {
      const title = s.title?.trim() ? s.title.trim() : `Source ${idx + 1}`;
      const hl = (s.highlights ?? []).slice(0, 8).map((h) => `  • ${h}`).join('\n');
      const transcript = s.transcript?.trim() ? s.transcript.trim() : '';
      return [
        `## ${title}`,
        hl ? `Highlights:\n${hl}` : '',
        transcript ? `Transcript:\n${transcript}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');

  return [
    `Project: ${projectName}`,
    `Output format: ${format}`,
    '',
    'Write a draft using only the provided material. Keep it structured and specific.',
    'If the material is thin, produce a short draft plus 3 targeted questions to ask next.',
    '',
    canonText ? `Canon (user-approved facts):\n${canonText}\n` : '',
    `Sources:\n${sourceText}`,
  ]
    .filter(Boolean)
    .join('\n');
}
