export type ContinuityBody = {
  summary?: string;
  lockedFacts?: Array<{ kind?: string; title?: string; detail?: string }>;
  target?: {
    title?: string;
    note?: string;
    index?: number;
    total?: number;
    beforeTitle?: string;
    afterTitle?: string;
  };
  priorPasses?: Array<{ title?: string; targetTitle?: string; summary?: string }>;
  driftRisks?: string[];
};

export function normalizeContinuity(input: ContinuityBody | undefined) {
  if (!input || typeof input !== 'object') return undefined;

  const lockedFacts = Array.isArray(input.lockedFacts)
    ? input.lockedFacts
        .map((item) => ({
          kind: typeof item?.kind === 'string' ? item.kind.trim().slice(0, 40) : undefined,
          title: typeof item?.title === 'string' ? item.title.trim().slice(0, 160) : '',
          detail: typeof item?.detail === 'string' ? item.detail.trim().slice(0, 600) : '',
        }))
        .filter((item) => item.title || item.detail)
        .slice(0, 18)
    : [];

  const priorPasses = Array.isArray(input.priorPasses)
    ? input.priorPasses
        .map((item) => ({
          title: typeof item?.title === 'string' ? item.title.trim().slice(0, 160) : '',
          targetTitle: typeof item?.targetTitle === 'string' ? item.targetTitle.trim().slice(0, 160) : undefined,
          summary: typeof item?.summary === 'string' ? item.summary.trim().slice(0, 500) : '',
        }))
        .filter((item) => item.title || item.summary)
        .slice(0, 4)
    : [];

  const driftRisks = Array.isArray(input.driftRisks)
    ? input.driftRisks.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim().slice(0, 240)).slice(0, 6)
    : [];

  const target = input.target && typeof input.target === 'object'
    ? {
        title: typeof input.target.title === 'string' ? input.target.title.trim().slice(0, 160) : undefined,
        note: typeof input.target.note === 'string' ? input.target.note.trim().slice(0, 500) : undefined,
        index: typeof input.target.index === 'number' ? input.target.index : undefined,
        total: typeof input.target.total === 'number' ? input.target.total : undefined,
        beforeTitle: typeof input.target.beforeTitle === 'string' ? input.target.beforeTitle.trim().slice(0, 160) : undefined,
        afterTitle: typeof input.target.afterTitle === 'string' ? input.target.afterTitle.trim().slice(0, 160) : undefined,
      }
    : undefined;

  const summary = typeof input.summary === 'string' ? input.summary.trim().slice(0, 400) : '';

  if (!summary && !lockedFacts.length && !priorPasses.length && !driftRisks.length && !target?.title) return undefined;

  return { summary, lockedFacts, target, priorPasses, driftRisks };
}

export function buildContinuityPromptBlock(continuity: ReturnType<typeof normalizeContinuity>) {
  if (!continuity) return '';

  const lockedFactsText = continuity.lockedFacts
    .map((item) => `- ${item.kind ? `[${item.kind}] ` : ''}${item.title}${item.detail ? `: ${item.detail}` : ''}`)
    .join('\n');

  const priorPassesText = continuity.priorPasses
    .map((item, index) => `- ${item.targetTitle ? `${item.targetTitle} — ` : ''}${item.title || `Prior pass ${index + 1}`}${item.summary ? `: ${item.summary}` : ''}`)
    .join('\n');

  const targetText = continuity.target?.title
    ? [
        `- Current target: ${continuity.target.title}`,
        continuity.target.note ? `- Target note: ${continuity.target.note}` : '',
        continuity.target.index && continuity.target.total ? `- Position: ${continuity.target.index} of ${continuity.target.total}` : '',
        continuity.target.beforeTitle ? `- Comes after: ${continuity.target.beforeTitle}` : '',
        continuity.target.afterTitle ? `- Leads into: ${continuity.target.afterTitle}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    : '';

  const driftText = continuity.driftRisks.map((item) => `- ${item}`).join('\n');

  return [
    'Continuity lock (treat this as hard project memory):',
    continuity.summary ? `- Summary: ${continuity.summary}` : '',
    targetText ? `Target continuity:\n${targetText}` : '',
    lockedFactsText ? `Locked story facts:\n${lockedFactsText}` : '',
    priorPassesText ? `Existing passes to stay compatible with:\n${priorPassesText}` : '',
    driftText ? `Drift risks to actively avoid:\n${driftText}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
