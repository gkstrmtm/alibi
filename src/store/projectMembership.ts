import type { AppState } from './types';

type ProjectStateSlice = Pick<AppState, 'entries' | 'projects'>;

export function buildStateWithAddedProjectEntry(
  state: ProjectStateSlice,
  payload: { projectId: string; entryId: string },
): ProjectStateSlice | null {
  const project = state.projects[payload.projectId];
  const entry = state.entries[payload.entryId];
  if (!project || !entry) return null;

  const nextProjects: AppState['projects'] = { ...state.projects };

  for (const [pid, existingProject] of Object.entries(nextProjects)) {
    if (pid === project.id) continue;
    if (!existingProject.entryIds.includes(entry.id)) continue;
    nextProjects[pid] = {
      ...existingProject,
      entryIds: existingProject.entryIds.filter((id) => id !== entry.id),
    };
  }

  const nextTarget = nextProjects[project.id] ?? project;
  const entryIds = nextTarget.entryIds.includes(entry.id) ? nextTarget.entryIds : [entry.id, ...nextTarget.entryIds];
  nextProjects[project.id] = { ...nextTarget, entryIds };

  return {
    projects: nextProjects,
    entries: {
      ...state.entries,
      [entry.id]: {
        ...entry,
        projectId: project.id,
      },
    },
  };
}

export function buildStateWithProjectEntries(
  state: ProjectStateSlice,
  payload: { projectId: string; entryIds: string[] },
): ProjectStateSlice | null {
  const project = state.projects[payload.projectId];
  if (!project) return null;

  const nextEntryIds = Array.from(new Set(payload.entryIds));
  const prevEntryIds = new Set(project.entryIds);
  const nextEntryIdSet = new Set(nextEntryIds);

  const nextEntries: AppState['entries'] = { ...state.entries };
  const nextProjects: AppState['projects'] = { ...state.projects };

  for (const entryId of nextEntryIds) {
    for (const [pid, existingProject] of Object.entries(nextProjects)) {
      if (pid === project.id) continue;
      if (!existingProject.entryIds.includes(entryId)) continue;
      nextProjects[pid] = {
        ...existingProject,
        entryIds: existingProject.entryIds.filter((id) => id !== entryId),
      };
    }
  }

  for (const entryId of prevEntryIds) {
    if (nextEntryIdSet.has(entryId)) continue;
    const entry = nextEntries[entryId];
    if (!entry) continue;
    if (entry.projectId !== project.id) continue;
    nextEntries[entryId] = { ...entry, projectId: undefined };
  }

  for (const entryId of nextEntryIds) {
    const entry = nextEntries[entryId];
    if (!entry) continue;
    nextEntries[entryId] = { ...entry, projectId: project.id };
  }

  const nextProject = nextProjects[project.id] ?? project;
  nextProjects[project.id] = { ...nextProject, entryIds: nextEntryIds };

  return {
    projects: nextProjects,
    entries: nextEntries,
  };
}
