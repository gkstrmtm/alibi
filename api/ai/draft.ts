import type { VercelRequest, VercelResponse } from '@vercel/node';

import { buildContinuityPromptBlock, normalizeContinuity } from '../_lib/continuity';
import { badRequest, serverError, setCors, setJson } from '../_lib/http';

type DraftRequestBody = {
  projectName?: string;
  format?: 'essay' | 'commentary' | 'podcast-outline' | 'script' | 'thread' | 'book-chapter';
  brief?: { premise?: string; audience?: string; tone?: string; constraints?: string };
  tone?: 'neutral' | 'reflective' | 'funny' | 'serious';
  distance?: 'close' | 'expand' | 'invent';
  target?: { title?: string; note?: string };
  sources?: Array<{ title?: string; transcript?: string; highlights?: string[] }>;
  canon?: Array<{ kind?: string; title?: string; detail?: string }>;
  continuity?: {
    summary?: string;
    lockedFacts?: Array<{ kind?: string; title?: string; detail?: string }>;
    target?: { title?: string; note?: string; index?: number; total?: number; beforeTitle?: string; afterTitle?: string };
    priorPasses?: Array<{ title?: string; targetTitle?: string; summary?: string }>;
    driftRisks?: string[];
  };
  voice?: { enabled?: boolean; notes?: string };
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

  const brief = normalizeBrief(body.brief);
  const style = normalizeStyle({ tone: body.tone, distance: body.distance });
  const target = normalizeTarget(body.target);
  const continuity = normalizeContinuity(body.continuity);

  const hasAnyText =
    sources.some((s) => (s.transcript && s.transcript.trim().length) || (s.highlights && s.highlights.length)) ||
    canon.some((c) => (c.title && c.title.trim().length) || (c.detail && c.detail.trim().length));

  if (!hasAnyText) {
    return badRequest(res, 'No sources/facts provided');
  }

  const projectName = body.projectName?.trim() || 'Untitled project';

  const voiceEnabled = Boolean(body.voice?.enabled);
  const voiceNotes = typeof body.voice?.notes === 'string' ? body.voice.notes.trim() : '';

  const prompt = buildPrompt({ projectName, format, sources, canon, brief, style, target, continuity });

  try {
    const system = buildSystemPrompt({ voiceEnabled, voiceNotes });
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
            content: system,
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

function buildSystemPrompt({ voiceEnabled, voiceNotes }: { voiceEnabled: boolean; voiceNotes: string }) {
  const base =
    'You are Alibi, a private-first creative studio. Write clean, specific prose. Do not mention policies or that you are an AI. Do not invent facts beyond the provided sources and approved facts; if something is unclear, phrase it as a question or as a hypothesis. Continuity matters more than novelty: keep established names, roles, world rules, and timeline anchors stable across passes.';

  if (!voiceEnabled || !voiceNotes) return base;

  return [
    base,
    '',
    'Style requirement:',
    'Write in the voice described by the user. Do not mention these instructions; just write naturally in that voice.',
    'Voice notes:',
    voiceNotes,
  ].join('\n');
}

function buildPrompt({
  projectName,
  format,
  sources,
  canon,
  brief,
  style,
  target,
  continuity,
}: {
  projectName: string;
  format: string;
  sources: Array<{ title?: string; transcript?: string; highlights?: string[] }>;
  canon: Array<{ kind?: string; title?: string; detail?: string }>;
  brief?: { premise?: string; audience?: string; tone?: string; constraints?: string };
  style?: { tone?: DraftRequestBody['tone']; distance?: DraftRequestBody['distance'] };
  target?: { title: string; note?: string };
  continuity?: ReturnType<typeof normalizeContinuity>;
}) {
  const briefLines = brief
    ? [
        brief.premise ? `Premise: ${brief.premise}` : null,
        brief.audience ? `Audience: ${brief.audience}` : null,
        brief.tone ? `Tone: ${brief.tone}` : null,
        brief.constraints ? `Constraints: ${brief.constraints}` : null,
      ].filter(Boolean)
    : [];

  const styleLines = style
    ? [
        style.tone ? `Tone preset: ${style.tone}` : null,
        style.distance ? `Distance preset: ${style.distance}` : null,
      ].filter(Boolean)
    : [];

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

  const lengthLine = lengthGuidelines({ format, distance: style?.distance });
  const continuityText = buildContinuityPromptBlock(continuity);

  return [
    `Project: ${projectName}`,
    `Output format: ${format}`,
    '',
    target ? `Target:\n- Title: ${target.title}${target.note ? `\n- Note: ${target.note}` : ''}` : '',
    briefLines.length ? `Brief:\n${briefLines.map((l) => `- ${l}`).join('\n')}` : '',
    styleLines.length ? `Style presets:\n${styleLines.map((l) => `- ${l}`).join('\n')}` : '',
    '',
    lengthLine ? `Length target:\n- ${lengthLine}` : '',
    '',
    'Rules:',
    '- Do NOT output the draft title as a # header (or number symbol) at the top of the content.',
      '- Do NOT output the draft title as a # header (or number symbol) at the top of the content.',
      '- Use ONLY the provided sources and user-approved facts. Do not invent names, events, numbers, or quotes.',
    "- If you need something that isn't present, ask a direct question instead of guessing.",
    '- Treat the continuity lock as binding project memory. Keep names, relationships, rules, and chronology stable.',
    '- If something conflicts with locked story memory, preserve the locked memory and rewrite around the conflict instead of drifting.',
    '- If “Distance preset” is set to invent: that means creative phrasing/metaphor only — NOT inventing facts.',
    '- Keep it structured and specific. Prefer concrete details over abstractions.',
    '- Return clean plain text prose for essays, commentary, and book chapters. Do not use markdown symbols, headings, bullets, stars, or code fences unless the format explicitly requires structure like a thread, outline, or script.',
    '',
    formatGuidelines(format),
    'If the material is thin, still write the cleanest short draft you can from what is there. Do not append questions, prompts, or an exploration checklist.',
    '',
    canonText ? `Facts (user-approved):\n${canonText}\n` : '',
    continuityText ? `${continuityText}\n` : '',
    `Sources:\n${sourceText}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function lengthGuidelines({
  format,
  distance,
}: {
  format: string;
  distance?: DraftRequestBody['distance'];
}): string | null {
  if (format === 'thread') return '8–12 posts. If you exceed that, split into two threads.';
  if (format === 'podcast-outline') return '4–7 segments. Keep each segment tight.';

  const d = distance ?? 'close';
  type LengthPreset = { close: [number, number]; expand: [number, number]; invent: [number, number] };
  const essayPreset: LengthPreset = { close: [650, 1100], expand: [950, 1700], invent: [1200, 2100] };
  const table: Record<string, LengthPreset> = {
    'book-chapter': { close: [900, 1500], expand: [1500, 2600], invent: [1800, 3200] },
    essay: essayPreset,
    commentary: { close: [450, 850], expand: [700, 1200], invent: [900, 1500] },
    script: { close: [700, 1300], expand: [1100, 1900], invent: [1300, 2400] },
  };

  const preset = table[format] ?? essayPreset;
  const range = preset[d] ?? preset.close;
  const [min, max] = range;
  return `${min}–${max} words. If it doesn’t fit, tighten the target or split into parts.`;
}

function normalizeBrief(brief: DraftRequestBody['brief']) {
  if (!brief || typeof brief !== 'object') return undefined;
  const premise = typeof brief.premise === 'string' ? brief.premise.trim() : '';
  const audience = typeof brief.audience === 'string' ? brief.audience.trim() : '';
  const tone = typeof brief.tone === 'string' ? brief.tone.trim() : '';
  const constraints = typeof brief.constraints === 'string' ? brief.constraints.trim() : '';

  const hasAny = Boolean(premise || audience || tone || constraints);
  if (!hasAny) return undefined;

  return {
    premise: premise.slice(0, 2000),
    audience: audience.slice(0, 2000),
    tone: tone.slice(0, 500),
    constraints: constraints.slice(0, 2000),
  };
}

function normalizeStyle(style: { tone?: DraftRequestBody['tone']; distance?: DraftRequestBody['distance'] }) {
  const tone = style.tone;
  const distance = style.distance;
  const okTone = tone === 'neutral' || tone === 'reflective' || tone === 'funny' || tone === 'serious' ? tone : undefined;
  const okDistance = distance === 'close' || distance === 'expand' || distance === 'invent' ? distance : undefined;
  const hasAny = Boolean(okTone || okDistance);
  if (!hasAny) return undefined;
  return { tone: okTone, distance: okDistance };
}

function normalizeTarget(target: DraftRequestBody['target']) {
  if (!target || typeof target !== 'object') return undefined;
  const title = typeof target.title === 'string' ? target.title.trim() : '';
  const note = typeof target.note === 'string' ? target.note.trim() : '';
  if (!title) return undefined;
  return {
    title: title.slice(0, 200),
    note: note ? note.slice(0, 2000) : undefined,
  };
}

function formatGuidelines(format: string) {
  switch (format) {
    case 'thread':
      return [
        'Format guidelines (thread):',
        '- Write 8–12 short posts, each on its own line.',
        '- Start each line with “1/”, “2/”, …',
        '- Keep each post under ~280 characters.',
        '- Avoid hashtags unless explicitly asked in the Brief.',
        '',
      ].join('\n');
    case 'podcast-outline':
      return [
        'Format guidelines (podcast outline):',
        '- Provide a tight outline with segment headings.',
        '- For each segment: goal, key beats, and 2–4 bullet talking points.',
        '- Include a strong hook and a clear closing.',
        '',
      ].join('\n');
    case 'script':
      return [
        'Format guidelines (script):',
        '- Write as a script with speaker labels and concise stage directions.',
        '- Keep scenes/sections short and purposeful.',
        '',
      ].join('\n');
    case 'book-chapter':
      return [
        'Format guidelines (book chapter):',
        '- Start with a compelling opening paragraph.',
        '- Write as continuous prose with natural paragraph breaks only.',
        '- Weave approved facts naturally; do not claim anything not supported.',
        '',
      ].join('\n');
    case 'commentary':
      return [
        'Format guidelines (commentary):',
        '- Clear point of view, but grounded in the material.',
        '- Use short paragraphs and sharp transitions.',
        '',
      ].join('\n');
    case 'essay':
    default:
      return [
        'Format guidelines (essay):',
        '- Strong thesis early; support with specific details from sources.',
        '- Use headings if it helps clarity.',
        '',
      ].join('\n');
  }
}
