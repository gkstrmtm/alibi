import type { Draft, Entry, NarrativeStage, OutlineItem, Project } from '../store/types';
import { makeId } from './id';

type StageTemplate = {
  stage: NarrativeStage;
  label: string;
  title: string;
  note: string;
  keywords: string[];
};

export type NarrativeStep = OutlineItem & {
  index: number;
  label: string;
  origin: 'manual' | 'auto';
  draftCount: number;
  status: 'planned' | 'next' | 'drafted' | 'expanded';
  isSuggestedNext: boolean;
};

const STAGE_TEMPLATES: StageTemplate[] = [
  {
    stage: 'premise',
    label: 'Story premise',
    title: 'Establish the core premise and promise',
    note: 'Anchor the initial boundary, the central promise, and what kind of project this is becoming.',
    keywords: ['premise', 'world', 'setting', 'promise', 'opening'],
  },
  {
    stage: 'introduction',
    label: 'Subject introduction',
    title: 'Introduce the core subjects or drivers',
    note: 'Show who or what the central focus is, what is needed, and what is still missing.',
    keywords: ['character', 'introduce', 'want', 'need', 'main character'],
  },
  {
    stage: 'early-conflict',
    label: 'Early conflict',
    title: 'Reveal the first obstacle or rejection',
    note: 'Let the story meet early friction so the project stops feeling hypothetical.',
    keywords: ['conflict', 'obstacle', 'rejection', 'friction', 'problem'],
  },
  {
    stage: 'discovery',
    label: 'Discovery',
    title: 'Discover a new strategy or opening',
    note: 'This is where a new tactic, insight, or path becomes available.',
    keywords: ['discover', 'strategy', 'idea', 'approach', 'opening'],
  },
  {
    stage: 'first-success',
    label: 'First success',
    title: 'Show the first small proof that it can work',
    note: 'Give the story an early win that creates momentum without resolving everything.',
    keywords: ['success', 'proof', 'works', 'first win', 'small win'],
  },
  {
    stage: 'escalation',
    label: 'Escalation',
    title: 'Expand the effort and raise the tension',
    note: 'Push the consequences outward so the stakes and complexity increase.',
    keywords: ['expand', 'tension', 'scale', 'raise', 'bigger'],
  },
  {
    stage: 'pressure',
    label: 'Rising pressure',
    title: 'Bring in stronger opposition or competition',
    note: 'The resistance gets smarter, harsher, or more expensive here.',
    keywords: ['opposition', 'competition', 'pressure', 'rival', 'threat'],
  },
  {
    stage: 'setback',
    label: 'Major setback',
    title: 'Land the major setback',
    note: 'Something breaks, fails, or collapses hard enough that the story has to adapt.',
    keywords: ['setback', 'loss', 'failure', 'collapse', 'break'],
  },
  {
    stage: 'reinvention',
    label: 'Reinvention',
    title: 'Reinvent the approach',
    note: 'The response to failure creates a better, sharper, or riskier path forward.',
    keywords: ['reinvent', 'adapt', 'change', 'pivot', 'new version'],
  },
  {
    stage: 'return',
    label: 'Momentum returns',
    title: 'Let momentum return with new leverage',
    note: 'The project regains force, but now the stakes are clearer and higher.',
    keywords: ['momentum', 'return', 'progress', 'traction', 'renewed'],
  },
  {
    stage: 'confrontation',
    label: 'Major confrontation',
    title: 'Force the major confrontation or turning point',
    note: 'The core pressure finally has to be faced directly.',
    keywords: ['confrontation', 'turning point', 'showdown', 'faceoff', 'decision'],
  },
  {
    stage: 'climax',
    label: 'Climax',
    title: 'Land the climactic success or failure',
    note: 'This is where the central effort finally resolves in success, failure, or irreversible change.',
    keywords: ['climax', 'peak', 'final success', 'final failure', 'culmination'],
  },
  {
    stage: 'resolution',
    label: 'Resolution',
    title: 'Resolve the meaning of what happened',
    note: 'Show what remains, what changed, and what the story means after the climax.',
    keywords: ['resolution', 'ending', 'after', 'meaning', 'consequence'],
  },
];

function cleanText(value?: string) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9\s]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function compactText(value?: string, max = 120) {
  const text = (value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function deriveTargetPartCount(project?: Project, draftsById?: Record<string, Draft | undefined>) {
  const outlineCount = project?.book?.outline?.length ?? 0;
  const entryCount = project?.entryIds?.length ?? 0;
  const canonCount = project?.book?.canon?.length ?? 0;
  const premiseLength = project?.book?.brief?.premise?.trim().length ?? 0;
  const draftCount = (project?.draftIds ?? []).map((id) => draftsById?.[id]).filter(Boolean).length;

  if (outlineCount) {
    if (outlineCount <= 4) return 4;
    if (outlineCount <= 6) return 6;
    if (outlineCount <= 8) return 8;
    if (outlineCount <= 10) return 10;
    return 12;
  }

  if (draftCount >= 6 || entryCount >= 10 || canonCount >= 8) return 12;
  if (draftCount >= 4 || entryCount >= 7 || canonCount >= 5) return 10;
  if (draftCount >= 2 || entryCount >= 4 || premiseLength >= 220) return 8;
  if (entryCount >= 2 || premiseLength >= 120 || canonCount >= 2) return 6;
  return 4;
}

export function createNarrativeScaffold(count: number): OutlineItem[] {
  return STAGE_TEMPLATES.slice(0, count).map((template, index) => ({
    id: makeId('ch'),
    title: template.title,
    note: template.note,
    stage: template.stage,
    autoGenerated: true,
  }));
}

function mergeOutlineWithScaffold(outline: OutlineItem[], scaffold: OutlineItem[]) {
  const merged: OutlineItem[] = [];
  const seen = new Set<string>();

  scaffold.forEach((step, index) => {
    const existing = outline[index];
    if (existing) {
      merged.push({
        ...step,
        ...existing,
        stage: existing.stage ?? step.stage,
        autoGenerated: existing.autoGenerated ?? false,
      });
      seen.add(existing.id);
      return;
    }
    merged.push(step);
    seen.add(step.id);
  });

  outline.forEach((step) => {
    if (seen.has(step.id)) return;
    merged.push(step);
  });

  return merged;
}

function draftCountByOutlineItem(project?: Project, draftsById?: Record<string, Draft | undefined>) {
  const counts = new Map<string, number>();
  for (const id of project?.draftIds ?? []) {
    const draft = draftsById?.[id];
    if (!draft?.targetOutlineItemId) continue;
    counts.set(draft.targetOutlineItemId, (counts.get(draft.targetOutlineItemId) ?? 0) + 1);
  }
  return counts;
}

function stageTemplateByStep(step: OutlineItem, index: number) {
  if (step.stage) return STAGE_TEMPLATES.find((template) => template.stage === step.stage);
  return STAGE_TEMPLATES[index];
}

function scoreStepMatch(step: OutlineItem, index: number, text: string) {
  const template = stageTemplateByStep(step, index);
  let score = 0;
  const title = cleanText(step.title);
  const note = cleanText(step.note);
  if (title && text.includes(title)) score += 9;
  if (note && text.includes(note)) score += 4;
  for (const token of title.split(' ').filter((part) => part.length >= 4)) {
    if (text.includes(token)) score += 1.8;
  }
  if (template) {
    for (const keyword of template.keywords) {
      const normalized = cleanText(keyword);
      if (normalized && text.includes(normalized)) score += 2.4;
    }
  }
  return score;
}

export function buildNarrativeProgress({
  project,
  draftsById,
}: {
  project?: Project;
  draftsById?: Record<string, Draft | undefined>;
}) {
  if (!project?.book) {
    return {
      steps: [] as NarrativeStep[],
      nextSuggestedStep: undefined as NarrativeStep | undefined,
      draftedCount: 0,
      total: 0,
    };
  }

  const partCount = deriveTargetPartCount(project, draftsById);
  const scaffold = createNarrativeScaffold(partCount);
  const merged = mergeOutlineWithScaffold(project.book.outline ?? [], scaffold);
  const counts = draftCountByOutlineItem(project, draftsById);
  const firstUndraftedId = merged.find((step) => !counts.get(step.id))?.id;
  const draftedCount = Array.from(counts.values()).filter((count) => count > 0).length;
  const activeAutoCount = Math.min(merged.length, Math.max(deriveTargetPartCount(project, draftsById), draftedCount + 2));
  const visible = merged.filter((step, index) => {
    if (!step.autoGenerated) return true;
    if (counts.get(step.id)) return true;
    if (step.id === firstUndraftedId) return true;
    return index < activeAutoCount;
  });

  const steps = visible.map((step, index) => {
    const template = stageTemplateByStep(step, index);
    const draftCount = counts.get(step.id) ?? 0;
    const isSuggestedNext = step.id === firstUndraftedId;
    return {
      ...step,
      index,
      label: template?.label ?? `Part ${index + 1}`,
      origin: step.autoGenerated ? 'auto' : 'manual',
      draftCount,
      status: draftCount > 1 ? 'expanded' : draftCount === 1 ? 'drafted' : isSuggestedNext ? 'next' : 'planned',
      isSuggestedNext,
    } satisfies NarrativeStep;
  });

  return {
    steps,
    nextSuggestedStep: steps.find((step) => step.isSuggestedNext) ?? steps[0],
    draftedCount: steps.filter((step) => step.draftCount > 0).length,
    total: steps.length,
  };
}

export function ensureNarrativeOutlineForDraft({
  project,
  draftsById,
  preferredTargetOutlineItemId,
  draftTitle,
  draftContent,
}: {
  project?: Project;
  draftsById?: Record<string, Draft | undefined>;
  preferredTargetOutlineItemId?: string;
  draftTitle?: string;
  draftContent?: string;
}) {
  if (!project?.book) {
    return {
      outline: project?.book?.outline ?? [],
      targetOutlineItemId: preferredTargetOutlineItemId,
    };
  }

  const progress = buildNarrativeProgress({ project, draftsById });
  const outline = progress.steps.map((step) => ({
    id: step.id,
    title: step.title,
    note: step.note,
    stage: step.stage,
    autoGenerated: step.origin === 'auto',
  }));

  if (preferredTargetOutlineItemId && outline.some((step) => step.id === preferredTargetOutlineItemId)) {
    return {
      outline,
      targetOutlineItemId: preferredTargetOutlineItemId,
    };
  }

  const text = cleanText(`${draftTitle ?? ''} ${draftContent ?? ''}`);
  const ranked = progress.steps
    .map((step, index) => ({ step, score: scoreStepMatch(step, index, text) }))
    .sort((a, b) => b.score - a.score || a.step.index - b.step.index);

  const matched = ranked[0];
  if (matched && matched.score >= 3.8 && (matched.step.draftCount > 0 || matched.step.isSuggestedNext)) {
    return {
      outline,
      targetOutlineItemId: matched.step.id,
    };
  }

  return {
    outline,
    targetOutlineItemId: progress.nextSuggestedStep?.id,
  };
}

export function describeNarrativeProgress({
  project,
  draftsById,
}: {
  project?: Project;
  draftsById?: Record<string, Draft | undefined>;
}) {
  const progress = buildNarrativeProgress({ project, draftsById });
  if (!progress.total) return 'Narrative path has not formed yet.';

  const next = progress.nextSuggestedStep;
  if (!next) return `${progress.draftedCount} of ${progress.total} narrative parts have draft coverage.`;

  return `${progress.draftedCount} of ${progress.total} parts have draft coverage. Next up: ${next.title}.`;
}

export function narrativeStepPreview(step: NarrativeStep) {
  return compactText(step.note || step.title, 96);
}
