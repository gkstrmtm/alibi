import type { Draft, Project } from '../store/types';

export type ContinuityPacket = {
  summary: string;
  lockedFacts: Array<{ kind?: string; title: string; detail: string }>;
  target?: {
    title?: string;
    note?: string;
    index?: number;
    total?: number;
    beforeTitle?: string;
    afterTitle?: string;
  };
  priorPasses: Array<{ title: string; targetTitle?: string; summary: string }>;
  driftRisks: string[];
};

function cleanText(value?: string) {
  return (value ?? '').replace(/[#*_>`~-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function firstParagraph(value?: string) {
  const text = cleanText(value);
  if (!text) return '';
  const parts = text
    .split(/\n{2,}/)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return parts[0] ?? text;
}

function compact(value: string, max = 220) {
  const text = value.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

export function buildContinuityPacket({
  project,
  draftsById,
  targetOutlineItemId,
  currentDraftId,
}: {
  project?: Project;
  draftsById?: Record<string, Draft | undefined>;
  targetOutlineItemId?: string;
  currentDraftId?: string;
}): ContinuityPacket | undefined {
  if (!project?.book) return undefined;

  const lockedFacts = (project.book.canon ?? [])
    .map((card) => ({
      kind: card.kind,
      title: cleanText(card.title) || 'Untitled',
      detail: cleanText(card.detail) || cleanText(card.title) || 'No detail provided.',
    }))
    .filter((card) => card.title || card.detail)
    .slice(0, 18);

  const outline = project.book.outline ?? [];
  const targetIndex = targetOutlineItemId ? outline.findIndex((item) => item.id === targetOutlineItemId) : -1;
  const target = targetIndex >= 0
    ? {
        title: outline[targetIndex]?.title,
        note: outline[targetIndex]?.note,
        index: targetIndex + 1,
        total: outline.length,
        beforeTitle: targetIndex > 0 ? outline[targetIndex - 1]?.title : undefined,
        afterTitle: targetIndex < outline.length - 1 ? outline[targetIndex + 1]?.title : undefined,
      }
    : undefined;

  const allDrafts = (project.draftIds ?? [])
    .map((id) => draftsById?.[id])
      .filter((draft): draft is Draft => Boolean(draft) && draft?.id !== currentDraftId);

  const orderedDrafts = [...allDrafts].sort((a, b) => b.createdAt - a.createdAt);
  const priorPasses = (targetIndex >= 0
    ? orderedDrafts
        .filter((draft) => {
          if (!draft.targetOutlineItemId) return false;
          const index = outline.findIndex((item) => item.id === draft.targetOutlineItemId);
          return index >= 0 && index < targetIndex;
        })
        .slice(0, 3)
    : orderedDrafts.slice(0, 3)
  ).map((draft) => ({
    title: cleanText(draft.title) || 'Untitled draft',
    targetTitle: draft.targetOutlineItemId ? outline.find((item) => item.id === draft.targetOutlineItemId)?.title : undefined,
    summary: compact(firstParagraph(draft.content) || 'No summary available yet.'),
  }));

  const characterNames = lockedFacts
    .filter((card) => card.kind === 'character')
    .map((card) => card.title)
    .slice(0, 4);

  const worldAnchors = lockedFacts
    .filter((card) => card.kind === 'world' || card.kind === 'timeline' || card.kind === 'claim')
    .map((card) => card.title)
    .slice(0, 4);

  const driftRisks = [
    characterNames.length ? `Keep ${characterNames.join(', ')} named and framed exactly as stored in story memory.` : null,
    worldAnchors.length ? `Keep ${worldAnchors.join(', ')} consistent across this draft.` : null,
    target?.title ? `Write this as ${target.title}${target.index && target.total ? ` (${target.index} of ${target.total})` : ''} without drifting into other story steps.` : null,
    priorPasses.length ? 'Stay compatible with the earlier drafts already on the project timeline.' : null,
  ].filter((item): item is string => Boolean(item));

  const summary = target?.title
    ? `Locked to ${target.title}${target.index && target.total ? ` (${target.index} of ${target.total})` : ''} with ${lockedFacts.length} project facts in memory.`
    : `${lockedFacts.length} project facts are locked for continuity across drafts.`;

  return {
    summary,
    lockedFacts,
    target,
    priorPasses,
    driftRisks,
  };
}
