import type { VercelRequest, VercelResponse } from '@vercel/node';

import { badRequest, serverError, setCors, setJson } from '../_lib/http';

type LiveSignalRequestBody = {
  recentTranscript?: string;
  runningSummary?: string;
  recentTakeaways?: string[];
  priorSignals?: Array<{ kind?: string; text?: string }>;
  objective?: string;
  mode?: 'free-think' | 'project' | 'book' | 'other';
  questioningMode?: 'listen' | 'clarify' | 'probe' | 'land';
  detectedLane?: {
    label?: string;
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
    category?: 'clarifying' | 'expanding' | 'structural';
    goal?: string;
    rationale?: string;
  };
};

type LiveSignalResult = {
  summary: string;
  signal: {
    kind: 'takeaway' | 'theme' | 'question' | 'direction';
    text: string;
    confidence: 'low' | 'medium' | 'high';
    questionCategory?: 'clarifying' | 'expanding' | 'structural';
    advancesProjectBy?: string;
  };
  takeaways: string[];
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
  const body = (req.body ?? {}) as LiveSignalRequestBody;

  const recentTranscript = (body.recentTranscript ?? '').trim();
  if (!recentTranscript) return badRequest(res, 'Missing recentTranscript');

  const prompt = buildPrompt({
    recentTranscript,
    runningSummary: (body.runningSummary ?? '').trim(),
    recentTakeaways: Array.isArray(body.recentTakeaways) ? body.recentTakeaways : [],
    priorSignals: Array.isArray(body.priorSignals) ? body.priorSignals : [],
    objective: (body.objective ?? '').trim(),
    mode: body.mode ?? 'free-think',
    questioningMode: body.questioningMode ?? 'listen',
    detectedLane: body.detectedLane,
    interviewState: body.interviewState,
    projectContext: body.projectContext,
    questionPlan: body.questionPlan,
  });

  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        messages: [
          {
            role: 'system',
            content:
              'You are Alibi, a silent thinking partner during an active voice session. Return valid JSON only. Be concise, intelligent, non-disruptive, and never over-claim certainty.',
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

    const normalized = normalizeLiveSignal(parsed.value);
    if (!normalized.ok) return serverError(res, (normalized as any).error);

    setJson(res);
    res.status(200).json({ ok: true, ...normalized.value });
  } catch (e: any) {
    return serverError(res, e?.message || 'Unknown error');
  }
}

function buildPrompt({
  recentTranscript,
  runningSummary,
  recentTakeaways,
  priorSignals,
  objective,
  mode,
  questioningMode,
  detectedLane,
  interviewState,
  projectContext,
  questionPlan,
}: {
  recentTranscript: string;
  runningSummary: string;
  recentTakeaways: string[];
  priorSignals: Array<{ kind?: string; text?: string }>;
  objective: string;
  mode: string;
  questioningMode: string;
  detectedLane?: {
    label?: string;
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
    category?: 'clarifying' | 'expanding' | 'structural';
    goal?: string;
    rationale?: string;
  };
}) {
  const priorSignalText = priorSignals
    .slice(-4)
    .map((s) => `- ${typeof s.kind === 'string' ? s.kind : 'signal'}: ${typeof s.text === 'string' ? s.text : ''}`.trim())
    .filter(Boolean)
    .join('\n');

  const takeawayText = recentTakeaways
    .slice(-4)
    .map((t) => `- ${t}`)
    .join('\n');

  const projectContextText = [
    typeof projectContext?.recentTitle === 'string' && projectContext.recentTitle.trim() ? `Recent project title: ${projectContext.recentTitle.trim()}` : '',
    Array.isArray(projectContext?.themes) && projectContext.themes.length ? `Known project threads:\n${projectContext.themes.slice(0, 5).map((item) => `- ${item}`).join('\n')}` : '',
    Array.isArray(projectContext?.highlights) && projectContext.highlights.length ? `Known project details:\n${projectContext.highlights.slice(0, 4).map((item) => `- ${item}`).join('\n')}` : '',
    typeof projectContext?.premise === 'string' && projectContext.premise.trim() ? `Project premise: ${projectContext.premise.trim()}` : '',
    Array.isArray(projectContext?.outlineSteps) && projectContext.outlineSteps.length ? `Known structure:\n${projectContext.outlineSteps.slice(0, 4).map((item) => `- ${item}`).join('\n')}` : '',
    Array.isArray(projectContext?.canon) && projectContext.canon.length ? `Canon or fixed anchors:\n${projectContext.canon.slice(0, 5).map((item) => `- ${item}`).join('\n')}` : '',
    typeof projectContext?.currentDraftTitle === 'string' && projectContext.currentDraftTitle.trim() ? `Current draft: ${projectContext.currentDraftTitle.trim()}` : '',
    typeof projectContext?.latestDraftTitle === 'string' && projectContext.latestDraftTitle.trim() ? `Latest project draft: ${projectContext.latestDraftTitle.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const questionPlanText = [
    questionPlan?.category ? `Preferred question category: ${questionPlan.category}` : '',
    questionPlan?.goal ? `Project-forward goal: ${questionPlan.goal}` : '',
    questionPlan?.rationale ? `Why this move now: ${questionPlan.rationale}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const laneText = detectedLane?.label
    ? [
        `Detected lane: ${detectedLane.label}`,
        Array.isArray(detectedLane?.supportingPhrases) && detectedLane.supportingPhrases.length
          ? `Lane support:\n${detectedLane.supportingPhrases.slice(0, 3).map((item) => `- ${item}`).join('\n')}`
          : '',
        typeof detectedLane?.stability === 'number' ? `Lane stability: ${detectedLane.stability.toFixed(2)}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  const interviewStateText = [
    Array.isArray(interviewState?.coveredDimensions) && interviewState.coveredDimensions.length
      ? `Already covered:\n${interviewState.coveredDimensions.slice(0, 6).map((item) => `- ${item}`).join('\n')}`
      : '',
    Array.isArray(interviewState?.missingDimensions) && interviewState.missingDimensions.length
      ? `Still thin / missing:\n${interviewState.missingDimensions.slice(0, 6).map((item) => `- ${item}`).join('\n')}`
      : '',
    interviewState?.recommendedFocus ? `Recommended next focus: ${interviewState.recommendedFocus}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return [
    `Session mode: ${mode}`,
    `Questioning mode: ${questioningMode}`,
    objective ? `Objective: ${objective}` : '',
    laneText ? `Conversation lane:\n${laneText}` : '',
    interviewStateText ? `Interview state:\n${interviewStateText}` : '',
    projectContextText ? `Project context:\n${projectContextText}` : '',
    questionPlanText ? `Question plan:\n${questionPlanText}` : '',
    runningSummary ? `Running summary:\n${runningSummary}` : '',
    takeawayText ? `Recent takeaways already shown:\n${takeawayText}` : '',
    priorSignalText ? `Recent signals already shown:\n${priorSignalText}` : '',
    '',
    'Task: Read the most recent transcript chunk and return one silent on-screen signal that helps the user develop the idea more clearly without interrupting them.',
    '',
    'Return JSON with this exact shape:',
    '{',
    '  "summary": string,',
    '  "signal": {',
    '    "kind": "takeaway" | "theme" | "question" | "direction",',
    '    "text": string,',
    '    "confidence": "low" | "medium" | "high",',
    '    "questionCategory"?: "clarifying" | "expanding" | "structural",',
    '    "advancesProjectBy"?: string',
    '  },',
    '  "takeaways": string[]',
    '}',
    '',
    'Rules:',
    '- Keep summary under 160 characters.',
    '- Keep signal text under 140 characters.',
    '- Surface only one signal.',
    '- Behave like a structured interviewer, not a reactive assistant.',
    '- Every question must move the project forward.',
    '- Track the dominant thread, not isolated words or one-off nouns.',
    '- Questions must build on the current lane and deepen the same idea instead of jumping sideways.',
    '- Valid question categories are only: clarifying, expanding, structural.',
    '- Clarifying questions remove ambiguity around motive, reasoning, intent, or the core claim.',
    '- Expanding questions deepen the idea with concrete detail, reactions, consequences, examples, or proof.',
    '- Structural questions organize the idea into sequence, role, buildup, turning point, or framework.',
    '- Never ask a random, surface-level, or filler question just to keep the conversation going.',
    '- If no question clearly advances the project, do not ask one; return a direction, theme, or takeaway instead.',
    '- If signal.kind is question, you must set signal.questionCategory and signal.advancesProjectBy.',
    '- signal.advancesProjectBy must briefly state what the question will unlock for the project.',
    '- Prefer the supplied question plan unless the transcript makes another of the three categories clearly more useful.',
    '- Treat the session as building a developing intellectual artifact, not merely generating transcript.',
    '- Prefer progressive interviewing: move through motivation, background, sequence, conflict, implications, and outcomes as the idea develops.',
    '- Use the interview state to avoid repeating what is already clear and to target what is still thin.',
    '- If questioningMode is listen, avoid asking a question unless the transcript clearly supports one focused next step.',
    '- If questioningMode is clarify, ask for precision around the current claim or idea.',
    '- If questioningMode is probe, ask one deeper follow-up that draws out detail, resistance, cause, stakes, or sequence.',
    '- If questioningMode is land, help the user articulate the consequence, outcome, or turning point.',
    '- Only use a theme or takeaway when the transcript materially supports it; otherwise ask or direct with purpose.',
    '- Prefer specifics, tension, contradiction, stakes, motivation, environment, or missing causal detail over broad abstraction.',
    '- Use project context only as a biasing frame; never force the current chunk to match it.',
    '- Do not repeat takeaways/signals already shown unless the new chunk materially strengthens them.',
    '- If uncertain, quietly summarize the lane or give a low-confidence direction instead of inventing a random question.',
    '- Good questions should help the user become more articulate and continue speaking naturally.',
    '- Do not write like a chatbot. This is a silent UI cue.',
    '- Do not mention policies, JSON, or that you are AI.',
    '',
    'Recent transcript chunk:',
    recentTranscript,
  ]
    .filter(Boolean)
    .join('\n');
}

function safeParseJsonObject(text: string): { ok: true; value: any } | { ok: false; error: string } {
  const trimmed = text.trim();

  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch {
    // continue
  }

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

function normalizeLiveSignal(value: any): { ok: true; value: LiveSignalResult } | { ok: false; error: string } {
  const summary = typeof value?.summary === 'string' ? value.summary.trim() : '';
  const kind = typeof value?.signal?.kind === 'string' ? value.signal.kind.trim() : '';
  const text = typeof value?.signal?.text === 'string' ? value.signal.text.trim() : '';
  const confidence = typeof value?.signal?.confidence === 'string' ? value.signal.confidence.trim() : '';
  const questionCategory = typeof value?.signal?.questionCategory === 'string' ? value.signal.questionCategory.trim() : '';
  const advancesProjectBy = typeof value?.signal?.advancesProjectBy === 'string' ? value.signal.advancesProjectBy.trim() : '';
  const takeaways = Array.isArray(value?.takeaways)
    ? value.takeaways.filter((x: any) => typeof x === 'string').map((x: string) => x.trim()).filter(Boolean)
    : [];

  if (!summary) return { ok: false, error: 'Missing summary' };
  if (!text) return { ok: false, error: 'Missing signal text' };
  if (!['takeaway', 'theme', 'question', 'direction'].includes(kind)) return { ok: false, error: 'Invalid signal kind' };
  if (!['low', 'medium', 'high'].includes(confidence)) return { ok: false, error: 'Invalid signal confidence' };
  if (questionCategory && !['clarifying', 'expanding', 'structural'].includes(questionCategory)) {
    return { ok: false, error: 'Invalid question category' };
  }
  if (kind === 'question' && (!questionCategory || !advancesProjectBy)) {
    return { ok: false, error: 'Question signals must include project-forward metadata' };
  }

  return {
    ok: true,
    value: {
      summary: summary.slice(0, 160),
      signal: {
        kind: kind as LiveSignalResult['signal']['kind'],
        text: text.slice(0, 140),
        confidence: confidence as LiveSignalResult['signal']['confidence'],
        questionCategory: questionCategory ? (questionCategory as LiveSignalResult['signal']['questionCategory']) : undefined,
        advancesProjectBy: advancesProjectBy ? advancesProjectBy.slice(0, 100) : undefined,
      },
      takeaways: takeaways.slice(0, 3),
    },
  };
}
