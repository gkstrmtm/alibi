import type { AppState, Draft, Project } from '../store/types';
import { makeId } from './id';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

function collectValidOutlineIdsByProjectId(projects: Record<string, Project>) {
  const validOutlineIdsByProjectId = new Map<string, Set<string>>();

  for (const project of Object.values(projects)) {
    if (!project.book) continue;
    validOutlineIdsByProjectId.set(
      project.id,
      new Set((project.book.outline ?? []).map((item) => item.id).filter(isUuid)),
    );
  }

  return validOutlineIdsByProjectId;
}

export function normalizeNarrativeReferences({
  projects,
  drafts,
  draftStyleByProjectId,
}: {
  projects: Record<string, Project>;
  drafts?: Record<string, Draft>;
  draftStyleByProjectId?: AppState['studio']['draftStyleByProjectId'];
}) {
  const outlineIdMapByProjectId = new Map<string, Map<string, string>>();
  let projectsChanged = false;

  const nextProjects = Object.fromEntries(
    Object.entries(projects).map(([projectId, project]) => {
      if (!project.book) return [projectId, project];

      const outlineIdMap = new Map<string, string>();
      let outlineChanged = false;
      const nextOutline = (project.book.outline ?? []).map((item) => {
        const currentId = typeof item.id === 'string' ? item.id : undefined;
        if (isUuid(currentId)) return item;

        outlineChanged = true;
        projectsChanged = true;

        if (currentId) {
          const mappedId = outlineIdMap.get(currentId) ?? makeId('ch');
          outlineIdMap.set(currentId, mappedId);
          return { ...item, id: mappedId };
        }

        return { ...item, id: makeId('ch') };
      });

      if (!outlineChanged) return [projectId, project];
      if (outlineIdMap.size) outlineIdMapByProjectId.set(project.id, outlineIdMap);

      return [
        projectId,
        {
          ...project,
          book: {
            ...project.book,
            outline: nextOutline,
          },
        },
      ];
    }),
  ) as Record<string, Project>;

  const validOutlineIdsByProjectId = collectValidOutlineIdsByProjectId(projectsChanged ? nextProjects : projects);

  const remapOutlineTarget = (projectId: string | undefined, targetOutlineItemId: string | undefined) => {
    if (!projectId || !targetOutlineItemId) return undefined;
    const remapped = outlineIdMapByProjectId.get(projectId)?.get(targetOutlineItemId) ?? targetOutlineItemId;
    const validIds = validOutlineIdsByProjectId.get(projectId);
    if (!validIds?.has(remapped)) return undefined;
    return remapped;
  };

  let draftsChanged = false;
  const nextDrafts = drafts
    ? (Object.fromEntries(
        Object.entries(drafts).map(([draftId, draft]) => {
          const nextTargetOutlineItemId = remapOutlineTarget(draft.projectId, draft.targetOutlineItemId);
          if (nextTargetOutlineItemId === draft.targetOutlineItemId) return [draftId, draft];
          draftsChanged = true;
          return [
            draftId,
            {
              ...draft,
              targetOutlineItemId: nextTargetOutlineItemId,
            },
          ];
        }),
      ) as Record<string, Draft>)
    : undefined;

  let draftStyleChanged = false;
  const nextDraftStyleByProjectId = draftStyleByProjectId
    ? (Object.fromEntries(
        Object.entries(draftStyleByProjectId).map(([projectId, style]) => {
          const nextTargetOutlineItemId = remapOutlineTarget(projectId, style?.targetOutlineItemId);
          if (nextTargetOutlineItemId === style?.targetOutlineItemId) return [projectId, style];
          draftStyleChanged = true;
          return [
            projectId,
            {
              ...style,
              targetOutlineItemId: nextTargetOutlineItemId,
            },
          ];
        }),
      ) as AppState['studio']['draftStyleByProjectId'])
    : undefined;

  return {
    projects: projectsChanged ? nextProjects : projects,
    drafts: draftsChanged && nextDrafts ? nextDrafts : drafts,
    draftStyleByProjectId:
      draftStyleChanged && nextDraftStyleByProjectId ? nextDraftStyleByProjectId : draftStyleByProjectId,
    changed: projectsChanged || draftsChanged || draftStyleChanged,
  };
}
