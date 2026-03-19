import type { VercelRequest, VercelResponse } from '@vercel/node';

import { buildContinuityPromptBlock, normalizeContinuity } from '../_lib/continuity';
import { badRequest, serverError, setCors, setJson } from '../_lib/http';

type ReviseDraftRequestBody = {
  projectName?: string;
  format?: 'essay' | 'commentary' | 'podcast-outline' | 'script' | 'thread' | 'book-chapter';
  draftTitle?: string;
  currentDraft?: string;
  target?: { scope?: 'full' | 'section'; heading?: string; content?: string };
  instruction?: string;
  brief?: { premise?: string; audience?: string; tone?: string; constraints?: string };
  tone?: 'neutral' | 'reflective' | 'funny' | 'serious';
  distance?: 'close' | 'expand' | 'invent';
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
  const body = (req.body ?? {}) as ReviseDraftRequestBody;

  const projectName = body.projectName?.trim() || 'Untitled project';
  const format = body.format ?? 'essay';
  const currentDraft = typeof body.currentDraft === 'string' ? body.currentDraft.trim() : '';
  const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : '';
  const targetScope = body.target?.scope === 'section' ? 'section' : 'full';
  const targetHeading = typeof body.target?.heading === 'string' ? body.target.heading.trim() : '';
  const targetContent = typeof body.target?.content === 'string' ? body.target.content.trim() : '';
  const sources = Array.isArray(body.sources) ? body.sources.slice(0, 12) : [];
  const canon = Array.isArray(body.canon) ? body.canon.slice(0, 24) : [];
  const continuity = normalizeContinuity(body.continuity);

  if (!currentDraft) return badRequest(res, 'Current draft is required');
  if (!instruction) return badRequest(res, 'Revision instruction is required');

  const voiceEnabled = Boolean(body.voice?.enabled);
  const voiceNotes = typeof body.voice?.notes === 'string' ? body.voice.notes.trim() : '';

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.55,
        messages: [
          { role: 'system', content: buildSystemPrompt({ voiceEnabled, voiceNotes }) },
          {
            role: 'user',
            content: buildPrompt({
              projectName,
              format,
              draftTitle: body.draftTitle?.trim(),
              currentDraft,
              instruction,
              targetScope,
              targetHeading,
              targetContent,
              brief: normalizeBrief(body.brief),
              style: normalizeStyle({ tone: body.tone, distance: body.distance }),
              sources,
              canon,
              continuity,
            }),
          },
        ],
      }),
    });

    if (!r.ok) {
      const text = await r.text();
      return serverError(res, `OpenAI error (${r.status}): ${text.slice(0, 800)}`);
    }

    const data = (await r.json()) as any;
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') return serverError(res, 'OpenAI response missing content');

    setJson(res);
    res.status(200).json({ ok: true, content: content.trim() });
  } catch (e: any) {
    return serverError(res, e?.message || 'Unknown error');
  }
}

function buildSystemPrompt({ voiceEnabled, voiceNotes }: { voiceEnabled: boolean; voiceNotes: string }) {
  const base =
    'You are Alibi, a private-first creative studio. Revise drafts cleanly and specifically. For essays, commentary, and book chapters, return plain prose with no markdown symbols or appendix-style notes. Do not mention policies or that you are an AI. Never invent facts beyond the provided draft, sources, approved facts, and continuity lock. Continuity matters more than novelty.';

  if (!voiceEnabled || !voiceNotes) return base;

  return [base, '', 'Keep the voice aligned to these notes:', voiceNotes].join('\n');
}

function buildPrompt({
  projectName,
  format,
  draftTitle,
  currentDraft,
  instruction,
  targetScope,
  targetHeading,
  targetContent,
  brief,
  style,
  sources,
  canon,
  continuity,
}: {
  projectName: string;
  format: string;
  draftTitle?: string;
  currentDraft: string;
  instruction: string;
  targetScope: 'full' | 'section';
  targetHeading?: string;
  targetContent?: string;
  brief?: { premise?: string; audience?: string; tone?: string; constraints?: string };
  style?: { tone?: ReviseDraftRequestBody['tone']; distance?: ReviseDraftRequestBody['distance'] };
  sources: Array<{ title?: string; transcript?: string; highlights?: string[] }>;
  canon: Array<{ kind?: string; title?: string; detail?: string }>;
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
    ? [style.tone ? `Tone preset: ${style.tone}` : null, style.distance ? `Distance preset: ${style.distance}` : null].filter(Boolean)
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
      return [`## ${title}`, hl ? `Highlights:\n${hl}` : '', transcript ? `Transcript:\n${transcript}` : ''].filter(Boolean).join('\n');
    })
    .join('\n\n');

  const targetBlock =
    targetScope === 'section'
      ? [`Target section: ${targetHeading || 'Unnamed section'}`, targetContent ? `Current section:\n${targetContent}` : ''].filter(Boolean).join('\n\n')
      : 'Target scope: full draft';

  const continuityText = buildContinuityPromptBlock(continuity);
  return [
    `Project: ${projectName}`,
    `Format: ${format}`,
    draftTitle ? `Draft title: ${draftTitle}` : '',
    briefLines.length ? `Brief:\n${briefLines.map((line) => `- ${line}`).join('\n')}` : '',
    styleLines.length ? `Style presets:\n${styleLines.map((line) => `- ${line}`).join('\n')}` : '',
    '',
    'Revision request:',
    instruction,
    '',
    targetBlock,
    '',
    'Rules:',
    '- For essays, commentary, and book chapters, return plain prose with normal paragraphs only.',
    '- Keep untouched sections unchanged if revising only one section.',
    '- Return only the revised target content. Do not prepend a heading label unless the format truly requires one.',
    '- Do not wrap the response in code fences.',
    '- Do not invent facts.',
    '',
    '- Treat the continuity lock as hard constraints. Keep established names, roles, rules, chronology, and chapter purpose stable.',
    canonText ? `Approved facts:\n${canonText}\n` : '',
    continuityText ? `${continuityText}\n` : '',
    sourceText ? `Sources:\n${sourceText}\n` : '',
    `Current full draft:\n${currentDraft}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function normalizeBrief(brief: ReviseDraftRequestBody['brief']) {
  if (!brief || typeof brief !== 'object') return undefined;
  const premise = typeof brief.premise === 'string' ? brief.premise.trim() : '';
  const audience = typeof brief.audience === 'string' ? brief.audience.trim() : '';
  const tone = typeof brief.tone === 'string' ? brief.tone.trim() : '';
  const constraints = typeof brief.constraints === 'string' ? brief.constraints.trim() : '';
  if (!premise && !audience && !tone && !constraints) return undefined;
  return { premise, audience, tone, constraints };
}

function normalizeStyle(style: { tone?: ReviseDraftRequestBody['tone']; distance?: ReviseDraftRequestBody['distance'] }) {
  const tone = style.tone;
  const distance = style.distance;
  const okTone = tone === 'neutral' || tone === 'reflective' || tone === 'funny' || tone === 'serious' ? tone : undefined;
  const okDistance = distance === 'close' || distance === 'expand' || distance === 'invent' ? distance : undefined;
  if (!okTone && !okDistance) return undefined;
  return { tone: okTone, distance: okDistance };
}
