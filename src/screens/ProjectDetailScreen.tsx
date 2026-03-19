import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/store';
import type { Draft, Entry, Project } from '../store/types';
import { Button } from '../components/Button';
import { ScreenLayout } from '../components/ScreenLayout';
import { Section } from '../components/Section';
import { ListRow } from '../components/ListRow';
import { Toast } from '../components/Toast';
import { TrueFocus } from '../components/TrueFocus';
import { getEntryRecordedSeconds } from '../utils/entryDuration';
import { tokens } from '../theme/tokens';
import { buildNarrativeProgress, describeNarrativeProgress, narrativeStepPreview } from '../utils/narrativeProgress';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectDetail'>;

function formatProjectStamp(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatCount(value: number, singular: string, plural?: string): string {
  return `${value} ${value === 1 ? singular : plural ?? `${singular}s`}`;
}

function formatEntryKind(kind: Entry['kind']): string {
  if (kind === 'voice') return 'Voice';
  if (kind === 'text') return 'Text';
  if (kind === 'video') return 'Video';
  return 'Import';
}

function formatRecordedTotal(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0m recorded';
  if (totalSeconds < 3600) return `${Math.max(1, Math.round(totalSeconds / 60))}m recorded`;

  const hours = totalSeconds / 3600;
  return `${hours < 10 ? hours.toFixed(1) : hours.toFixed(0)}h recorded`;
}

function formatRecordedStat(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0m';
  if (totalSeconds < 3600) return `${Math.max(1, Math.round(totalSeconds / 60))}m`;

  const hours = totalSeconds / 3600;
  return `${hours < 10 ? hours.toFixed(1) : hours.toFixed(0)}h`;
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function deriveConceptualFocus(project: Project | undefined, entries: Entry[]) {
  const genericTerms = new Set([
    'story',
    'chapter',
    'draft',
    'outline',
    'memory',
    'context',
    'project',
    'thread',
    'step',
    'part',
    'scene',
    'opening',
    'middle',
    'turn',
  ]);
  const noiseTerms = new Set([
    'its',
    'it',
    'this',
    'that',
    'these',
    'those',
    'there',
    'their',
    'them',
    'they',
    'then',
    'with',
    'from',
    'into',
    'about',
    'because',
    'through',
    'would',
    'could',
    'should',
    'have',
    'been',
    'being',
    'just',
  ]);
  const scoreByKey = new Map<string, { label: string; score: number }>();

  const pushTerm = (value: string | undefined, weight: number) => {
    const clean = (value ?? '').replace(/[_-]+/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
    const parts = clean
      .toLowerCase()
      .split(' ')
      .map((part) => part.trim())
      .filter((part) => part.length > 1 && !noiseTerms.has(part));
    const normalized = parts.join(' ').trim();
    if (!normalized || normalized.length < 4) return;
    if (genericTerms.has(normalized)) return;
    const current = scoreByKey.get(normalized);
    scoreByKey.set(normalized, {
      label: current?.label ?? toTitleCase(normalized),
      score: (current?.score ?? 0) + weight,
    });
  };

  if (project?.type === 'book' && project.book) {
    project.book.canon.forEach((card) => pushTerm(card.title, 5));
    project.book.outline.forEach((item) => pushTerm(item.title, 2));
    (project.book.brief?.premise?.split(/[.?!,]/g) ?? []).forEach((part) => pushTerm(part, 1));
  }

  entries
    .filter((entry) => entry.status === 'extracted')
    .forEach((entry) => {
      (entry.themes ?? []).forEach((theme) => pushTerm(theme, 4));
      (entry.ideas ?? []).forEach((idea) => pushTerm(idea.title, 3));
      (entry.highlights ?? [])
        .slice(0, 3)
        .forEach((highlight) => highlight.split(/[.?!,;:\u2014\u2013]/g).forEach((part) => pushTerm(part, 1)));
    });

  const ranked = Array.from(scoreByKey.values())
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, 5)
    .map((item) => item.label.replace(/\s+/g, ' ').trim().replace(/ /g, '\u00A0'));

  if (ranked.length) return ranked.join(' · ');
  return 'Motive · Pressure · Stakes · Change · Continuity';
}

export function ProjectDetailScreen({ route, navigation }: Props) {
  const { projectId, toastMessage: routeToastMessage } = route.params;
  const { state, dispatch } = useAppStore();
  const project = state.projects[projectId];
  const [toastMessage, setToastMessage] = React.useState<string | null>(routeToastMessage ?? null);

  useEffect(() => {
    setToastMessage(routeToastMessage ?? null);
  }, [routeToastMessage]);

  const entries = useMemo(() => {
    if (!project) return [];
    return project.entryIds
      .map((id) => state.entries[id])
      .filter((e): e is Entry => Boolean(e))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [project, state.entries]);

  const drafts = useMemo(() => {
    if (!project) return [];
    return project.draftIds
      .map((id) => state.drafts[id])
      .filter((d): d is Draft => Boolean(d))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [project, state.drafts]);

  const extractedCount = useMemo(() => entries.filter((entry) => entry.status === 'extracted').length, [entries]);
  const totalRecordedSeconds = useMemo(() => entries.reduce((sum, entry) => sum + getEntryRecordedSeconds(entry), 0), [entries]);
  const passLabel = project?.type === 'book' ? 'chapter draft' : 'writing draft';
  const passLabelPlural = project?.type === 'book' ? 'chapter drafts' : 'writing drafts';
  const latestExtractedEntry = useMemo(() => entries.find((entry) => entry.status === 'extracted'), [entries]);
  const narrativeProgress = useMemo(
    () => buildNarrativeProgress({ project, draftsById: state.drafts }),
    [project, state.drafts],
  );
  const chapterGroups = useMemo(() => {
    if (project?.type !== 'book') return [] as Array<{ step: (typeof narrativeProgress.steps)[number]; current?: Draft; variants: Draft[] }>;

    return narrativeProgress.steps.map((step) => {
      const variants = drafts
        .filter((draft) => draft.targetOutlineItemId === step.id)
        .sort((a, b) => b.createdAt - a.createdAt);

      return {
        step,
        current: variants[0],
        variants: variants.slice(1),
      };
    });
  }, [drafts, narrativeProgress.steps, project?.type]);
  const currentChapterOutputCount = useMemo(() => chapterGroups.filter((group) => group.current).length, [chapterGroups]);
  const unplacedDrafts = useMemo(() => {
    if (project?.type !== 'book') return drafts;
    const knownStepIds = new Set(narrativeProgress.steps.map((step) => step.id));
    return drafts.filter((draft) => !draft.targetOutlineItemId || !knownStepIds.has(draft.targetOutlineItemId));
  }, [drafts, narrativeProgress.steps, project?.type]);
  const latestProjectMove = useMemo(() => {
    const latestEntry = entries[0];
    const latestDraft = drafts[0];
    if (!latestEntry && !latestDraft) return null;
    if (latestEntry && (!latestDraft || latestEntry.createdAt >= latestDraft.createdAt)) {
      return `Latest entry • ${formatProjectStamp(latestEntry.createdAt)}`;
    }
    return latestDraft ? `Latest writing • ${formatProjectStamp(latestDraft.createdAt)}` : null;
  }, [drafts, entries]);

  const headerSummary = useMemo(() => {
    if (!entries.length) return 'Start by adding entries to the project. Structure and chapter writing come after that.';
    if (!drafts.length) return project?.type === 'book' ? 'Entries are landing. Shape the chapter path, then build the first chapter output.' : 'Entries are landing. Shape them into writing when the signal is strong enough.';
    return project?.type === 'book' ? 'This project now has entries, a narrative path, and chapter writing in motion.' : 'This project has entries and writing in motion.';
  }, [drafts.length, entries.length, project?.type]);

  const pulseCards = useMemo(
    () => [
      {
        label: 'Entries',
        value: String(entries.length),
        detail:
          entries.length === 0
            ? 'Voice, text, and imports land here first.'
            : entries.length === 1
              ? 'One entry is anchoring the project.'
              : `${formatCount(entries.length, 'entry', 'entries')} are giving the project weight.`,
        tone: 'base' as const,
      },
      {
        label: 'Signal',
        value: String(extractedCount),
        detail:
          extractedCount > 0
            ? `${formatCount(extractedCount, 'entry', 'entries')} already surfaced reusable threads.`
            : entries.length > 0
              ? 'As entries digest, the useful threads condense here.'
              : 'Themes and highlights sharpen after the first entry.',
        tone: 'cool' as const,
      },
      {
        label: project?.type === 'book' ? 'Chapters' : 'Drafts',
        value: String(project?.type === 'book' ? currentChapterOutputCount : drafts.length),
        detail:
          project?.type === 'book'
            ? currentChapterOutputCount === 0
              ? 'No chapter outputs yet. Build the first chapter when the material is ready.'
              : currentChapterOutputCount === 1
                ? 'One chapter already has a current output.'
                : `${currentChapterOutputCount} chapters already have current outputs.`
            : drafts.length === 0
              ? 'Written drafts gather only after the material earns it.'
              : drafts.length === 1
                ? `One ${passLabel} is already in motion.`
                : `${drafts.length} ${passLabelPlural} are pushing the project forward.`,
        tone: 'warm' as const,
      },
    ],
    [currentChapterOutputCount, drafts.length, entries.length, extractedCount, passLabel, passLabelPlural, project?.type],
  );

  const focusSentence = useMemo(() => {
    return deriveConceptualFocus(project, entries);
  }, [entries, project]);
  const nextChapterGroup = useMemo(
    () => chapterGroups.find((group) => group.step.isSuggestedNext) ?? chapterGroups.find((group) => !group.current),
    [chapterGroups],
  );

  const outlineProgress = useMemo(() => {
    if (!project || project.type !== 'book' || !project.book) return null;
    const remaining = narrativeProgress.steps.filter((step) => step.draftCount === 0).length;
    return {
      nextTitle: narrativeProgress.nextSuggestedStep?.title ?? null,
      remaining,
      total: narrativeProgress.total,
    };
  }, [narrativeProgress, project]);

  const briefLine = useMemo(() => {
    if (!project || project.type !== 'book' || !project.book) return null;
    const premise = project.book.brief?.premise?.trim();
    return premise ? premise : null;
  }, [project]);

  useEffect(() => {
    if (project?.type !== 'book') return;
    if (project.book?.outline?.length) return;
    dispatch({ type: 'book.materializeNarrativeOutline', payload: { projectId } });
  }, [dispatch, project?.book?.outline?.length, project?.type, projectId]);

  if (!project) {
    return (
      <ScreenLayout title="Project">
        <Text style={styles.muted}>Project not found.</Text>
      </ScreenLayout>
    );
  }

  let softProbe: { label: string; field: 'brief.premise' | 'brief.audience' | 'brief.tone' } | null = null;
  if (project?.type === 'book') {
    if (!project.book?.brief?.premise) { softProbe = { label: 'Who is the main protagonist? Tap to explain.', field: 'brief.premise' }; }
    else if (!project.book?.brief?.audience) { softProbe = { label: 'Who is this book actually for? Tap to talk it out.', field: 'brief.audience' }; }
    else if (!project.book?.brief?.tone) { softProbe = { label: 'What is the tone or vibe? Tap to set the mood.', field: 'brief.tone' }; }
  }

  return (
    <ScreenLayout title={project.name} topRight={<Pressable onPress={() => navigation.navigate('ProjectSettings', { projectId })}><Ionicons name="settings-outline" size={24} color={tokens.color.textMuted} /></Pressable>}>
      <Toast message={toastMessage} tone="success" onHide={() => setToastMessage(null)} />
      <ScrollView contentContainerStyle={styles.scroll} overScrollMode="never" bounces={false} showsVerticalScrollIndicator={false}>
          {softProbe && (
            <Pressable
              style={styles.softProbeBanner}
              onPress={() => navigation.navigate('Recording', { projectId, returnTo: 'project', targetProperty: softProbe!.field, promptLabel: softProbe!.label })}
            >
              <View style={styles.softProbeIconRing}>
                <Ionicons name="mic-outline" size={20} color={tokens.color.brand} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.softProbeTitle}>Missing Context</Text>
                <Text style={styles.softProbeText}>{softProbe.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={tokens.color.surface} />
            </Pressable>
          )}
          <View style={styles.headerCard}>
          <View style={styles.headerTopRow}>
            <View style={styles.typePill}>
              <Text style={styles.typePillText}>{project.type === 'book' ? 'Book' : 'Project'}</Text>
            </View>
            <Text style={styles.projectMeta}>
              {`${formatCount(entries.length, 'entry', 'entries')} • ${formatCount(drafts.length, 'draft')} • ${formatRecordedTotal(totalRecordedSeconds)}`}
            </Text>
          </View>
          <Text style={styles.projectSummary}>{headerSummary}</Text>
          {briefLine ? <Text style={styles.projectBrief}>{briefLine}</Text> : null}
          <Text style={styles.projectMeta}>
            {latestProjectMove ?? 'The first real move sets the tone for everything after it.'}
          </Text>

          <View style={styles.pulseGrid}>
            {pulseCards.map((card) => (
              <View
                key={card.label}
                style={[
                  styles.pulseCard,
                  card.tone === 'cool' ? styles.pulseCardCool : null,
                  card.tone === 'warm' ? styles.pulseCardWarm : null,
                ]}
              >
                <Text style={styles.pulseLabel}>{card.label}</Text>
                <Text style={styles.pulseValue}>{card.value}</Text>
                <Text style={styles.pulseDetail}>{card.detail}</Text>
              </View>
            ))}
          </View>
        </View>

        <Section title="Project signal">
          <View style={{ backgroundColor: tokens.color.surface, borderRadius: tokens.radius[16], padding: tokens.space[16], overflow: 'hidden' }}>
            <Text style={styles.focusMeta}>A live read of the strongest repeated signals across entries, memory, and structure.</Text>
            <TrueFocus sentence={focusSentence} separator=" · " maxItems={5} />
          </View>
        </Section>

        

        <Section title="Project entries">
          <View style={styles.blueprintCard}>
            <Text style={styles.blueprintTitle}>{project.type === 'book' ? 'Entries belong to the whole project.' : 'Entries are what the project writes from.'}</Text>
            <Text style={styles.blueprintSubtitle}>{project.type === 'book' ? 'Entries feed the narrative as a whole. They should live here, not inside individual chapter draft cards.' : 'Voice notes, text, and imports collect here first. Writing should only form after the material has signal.'}</Text>
            <View style={styles.statStrip}>
              <View style={styles.statPill}>
                <Text style={styles.statPillValue}>{entries.length}</Text>
                <Text style={styles.statPillLabel}>Total</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statPillValue}>{extractedCount}</Text>
                <Text style={styles.statPillLabel}>Ready</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statPillValue}>{project.type === 'book' ? currentChapterOutputCount : drafts.length}</Text>
                <Text style={styles.statPillLabel}>{project.type === 'book' ? 'Chapters' : 'Drafts'}</Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statPillValue}>{formatRecordedStat(totalRecordedSeconds)}</Text>
                <Text style={styles.statPillLabel}>Recorded</Text>
              </View>
            </View>
            <View style={styles.emptyActions}>
              <View style={styles.emptyActionItem}>
                <Button label="Record entry" onPress={() => navigation.navigate('Recording', { source: 'project', projectId, returnTo: 'project' })} />
              </View>
              <View style={styles.emptyActionItem}>
                <Button label="Add entry" variant="secondary" onPress={() => navigation.navigate('SelectEntries', { projectId: project.id })} />
              </View>
            </View>
          </View>

          {entries.length ? (
            entries.slice(0, 6).map((e) => (
              <ListRow
                key={e.id}
                title={e.title}
                subtitle={`${formatEntryKind(e.kind)} • ${formatProjectStamp(e.createdAt)}`}
                right={e.status === 'processing' ? 'Digesting' : e.status === 'extracted' ? 'Ready' : 'Captured'}
                onPress={() => navigation.navigate('EntryDetail', { entryId: e.id })}
              />
            ))
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Add entries before you shape writing.</Text>
              <Text style={styles.emptySubtitle}>Drop in voice, text, or imports. The useful structure comes after there is something real to shape.</Text>
              <View style={styles.tagRow}>
                <View style={styles.tagPill}>
                  <Text style={styles.tagText}>Voice</Text>
                </View>
                <View style={styles.tagPill}>
                  <Text style={styles.tagText}>Typed note</Text>
                </View>
                <View style={styles.tagPill}>
                  <Text style={styles.tagText}>Import</Text>
                </View>
              </View>
            </View>
          )}
        </Section>

        {project.type === 'book' && project.book ? (
          <Section title="Chapter path">
            <View style={styles.blueprintCard}>
              <Text style={styles.blueprintTitle}>Chapters live inside this project.</Text>
              <Text style={styles.blueprintSubtitle}>
                {outlineProgress?.nextTitle
                  ? `${describeNarrativeProgress({ project, draftsById: state.drafts })} ${outlineProgress.remaining > 0 ? `${outlineProgress.remaining} chapter lanes still need a current draft.` : 'Every active chapter lane already has a current draft.'}`
                  : describeNarrativeProgress({ project, draftsById: state.drafts })}
              </Text>

              <View style={styles.chapterStack}>
                {chapterGroups
                  .filter((group, index) => {
                    // Show if it has a draft
                    if (group.current) return true;
                    // Show if it is the immediately next empty step
                    const previousWasDraft = index > 0 ? Boolean(chapterGroups[index - 1].current) : true;
                    if (previousWasDraft || group.step.isSuggestedNext) return true;
                    // Otherwise, collapse it to reduce visual clutter
                    return false;
                  })
                  .map((group, index) => (
                    <View
                      key={group.step.id}
                      style={[styles.chapterCard, group.step.isSuggestedNext && !group.current ? styles.chapterCardNext : null]}
                    >
                      <View style={styles.chapterTopRow}>
                        <View style={styles.chapterIndexPill}>
                          <Text style={styles.chapterIndexText}>{chapterGroups.findIndex(g => g.step.id === group.step.id) + 1}</Text>
                        </View>
                        <View style={styles.chapterCopy}>
                          <Text style={styles.chapterTitle}>{group.step.title}</Text>
                          <Text style={styles.chapterMeta}>
                            {group.current
                              ? `Current draft • v${group.current.version}`
                              : group.step.isSuggestedNext
                                ? 'Next suggested chapter lane'
                                : group.step.origin === 'auto'
                                  ? 'Planned chapter lane'
                                  : 'Manual chapter lane'}
                          </Text>
                          <Text style={styles.chapterNote}>{narrativeStepPreview(group.step)}</Text>
                        </View>
                      </View>

                      {group.current ? (
                        <Pressable style={styles.outputCard} onPress={() => navigation.navigate('Output', { draftId: group.current!.id })}>
                          <Text style={styles.outputEyebrow}>CURRENT OUTPUT</Text>
                          <Text style={styles.outputTitle}>{group.current.title}</Text>
                          <Text style={styles.outputMeta}>{`v${group.current.version} • ${formatProjectStamp(group.current.createdAt)} • ${formatCount(group.current.entryIds.length, 'entry', 'entries')}`}</Text>
                        </Pressable>
                      ) : (
                        <View style={styles.outputCardEmpty}>
                          <Text style={styles.outputEyebrow}>CURRENT OUTPUT</Text>
                          <Text style={styles.outputTitle}>No chapter draft yet</Text>
                          <Text style={styles.outputMeta}>Use the project studio to build the first current version for this lane.</Text>
                        </View>
                      )}

                      {group.variants.length ? (
                        <View style={styles.variantStack}>
                          <Text style={styles.variantHeading}>Earlier versions</Text>
                          {group.variants.slice(0, 2).map((draft) => (
                            <Pressable key={draft.id} style={styles.outputCard} onPress={() => navigation.navigate('Output', { draftId: draft.id })}>
                              <Text style={styles.outputTitle}>{draft.title}</Text>
                              <Text style={styles.outputMeta}>{`v${draft.version} • ${formatProjectStamp(draft.createdAt)}`}</Text>
                            </Pressable>
                          ))}
                        </View>
                      ) : null}

                      {(!group.current && group.step.isSuggestedNext) ? (
                        <View style={styles.stickyRow}>
                          <View style={styles.stickyItem}>
                            <Button
                              label="Draft chapter"
                              onPress={() => {
                                dispatch({ type: 'studio.setMode', payload: { projectId, mode: 'draft' } });
                                dispatch({
                                  type: 'studio.setDraftStyle',
                                  payload: { projectId, targetOutlineItemId: group.step.id },
                                });
                                navigation.navigate('Studio', { projectId });
                              }}
                            />
                          </View>
                        </View>
                      ) : null}
                    </View>
                  ))}
                  
                  {(() => {
                    const hiddenCount = chapterGroups.filter((group, index) => {
                      if (group.current) return false;
                      const previousWasDraft = index > 0 ? Boolean(chapterGroups[index - 1].current) : true;
                      if (previousWasDraft || group.step.isSuggestedNext) return false;
                      return true;
                    }).length;
                    
                    if (hiddenCount > 0) {
                      return (
                        <Pressable 
                          style={styles.hiddenChaptersCard} 
                          onPress={() => navigation.navigate('ProjectSettings', { projectId, focusSection: 'outline' })}
                        >
                          <Text style={styles.hiddenChaptersText}>+{hiddenCount} planned chapters coming up (Tap to map chapters)</Text>
                        </Pressable>
                      );
                    }
                    return null;
                  })()}
              </View>

              {unplacedDrafts.length ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>Loose chapter outputs</Text>
                  <Text style={styles.emptySubtitle}>These drafts are still in the project, but they are not attached to a chapter lane yet.</Text>
                  {unplacedDrafts.slice(0, 4).map((draft) => (
                    <ListRow
                      key={draft.id}
                      title={draft.title}
                      subtitle={`v${draft.version} • ${formatProjectStamp(draft.createdAt)}`}
                      onPress={() => navigation.navigate('Output', { draftId: draft.id })}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          </Section>
        ) : null}


        {project.type !== 'book' ? (
          <Section title="Current writing">
            {drafts.length ? (
              <View style={styles.blueprintCard}>
                <Text style={styles.blueprintTitle}>Writing belongs in its own lane.</Text>
                <Text style={styles.blueprintSubtitle}>Entries live above. These are the current writing attempts for the project.</Text>
                {drafts.slice(0, 6).map((draft) => (
                  <ListRow
                    key={draft.id}
                    title={draft.title}
                    subtitle={`v${draft.version} • ${formatProjectStamp(draft.createdAt)} • ${formatCount(draft.entryIds.length, 'entry', 'entries')}`}
                    onPress={() => navigation.navigate('Output', { draftId: draft.id })}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No writing yet.</Text>
                <Text style={styles.emptySubtitle}>Once the entries have enough signal, build a draft here instead of letting writing blur into raw captures.</Text>
                <View style={styles.emptyActions}>
                  <View style={styles.emptyActionItem}>
                    <Button label="Open writing studio" onPress={() => navigation.navigate('Studio', { projectId })} />
                  </View>
                </View>
              </View>
            )}
          </Section>
        ) : null}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: tokens.space[24],
    gap: tokens.space[16],
  },
  headerCard: {
    padding: tokens.space[16],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius[12],
    gap: tokens.space[12],
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space[12],
  },
  typePill: {
    paddingHorizontal: tokens.space[12],
    paddingVertical: tokens.space[4],
    borderRadius: 999,
    backgroundColor: tokens.color.surface2,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  typePillText: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
  },
  projectSummary: {
    fontSize: tokens.font.size[16],
    lineHeight: 22,
    fontWeight: tokens.font.weight.medium,
    color: tokens.color.text,
  },
  projectMeta: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
  },
  focusMeta: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
    lineHeight: 18,
    marginBottom: tokens.space[8],
  },
  projectBrief: {
    fontSize: tokens.font.size[14],
    color: tokens.color.text,
    lineHeight: 20,
  },
  pulseGrid: {
    flexDirection: 'row',
    gap: tokens.space[8],
  },
  pulseCard: {
    flex: 1,
    minHeight: 124,
    padding: tokens.space[12],
    borderRadius: tokens.radius[12],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.surface,
    gap: tokens.space[8],
  },
  pulseCardCool: {
    backgroundColor: tokens.color.surface3,
  },
  pulseCardWarm: {
    backgroundColor: tokens.color.surface2,
  },
  pulseLabel: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textFaint,
  },
  pulseValue: {
    fontSize: tokens.font.size[20],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
  },
  pulseDetail: {
    fontSize: tokens.font.size[12],
    lineHeight: 18,
    color: tokens.color.textMuted,
  },
  intakeCard: {
    padding: tokens.space[16],
    borderWidth: 1,
    borderColor: tokens.color.accentRing,
    backgroundColor: tokens.color.accentSoft,
    borderRadius: tokens.radius[12],
    gap: tokens.space[12],
  },
  intakeTitle: {
    fontSize: tokens.font.size[18],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.accent,
  },
  intakeSubtitle: {
    fontSize: tokens.font.size[14],
    color: tokens.color.text,
    lineHeight: 22,
  },
  nextStepCard: {
    padding: tokens.space[16],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.surface2,
    borderRadius: tokens.radius[12],
    gap: tokens.space[8],
  },
  nextStepTitle: {
    fontSize: tokens.font.size[14],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
  },
  nextStepSubtitle: {
    fontSize: tokens.font.size[14],
    color: tokens.color.textMuted,
  },
  nextStepActions: {
    flexDirection: 'row',
    gap: tokens.space[12],
    paddingTop: tokens.space[4],
  },
  nextStepActionItem: {
    flex: 1,
  },
  muted: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
  },
  emptyCard: {
    padding: tokens.space[16],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius[12],
    gap: tokens.space[12],
  },
  emptyTitle: {
    fontSize: tokens.font.size[14],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
  },
  emptySubtitle: {
    fontSize: tokens.font.size[14],
    lineHeight: 20,
    color: tokens.color.textMuted,
  },
  ghostStack: {
    gap: tokens.space[8],
  },
  ghostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[8],
    paddingVertical: tokens.space[12],
    paddingHorizontal: tokens.space[12],
    borderRadius: tokens.radius[10],
    backgroundColor: tokens.color.surface2,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  ghostDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: tokens.color.accent,
  },
  ghostDotCool: {
    backgroundColor: '#6B86D8',
  },
  ghostDotWarm: {
    backgroundColor: tokens.color.accent2,
  },
  ghostText: {
    flex: 1,
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space[8],
  },
  tagPill: {
    paddingHorizontal: tokens.space[12],
    paddingVertical: tokens.space[4],
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.surface2,
  },
  tagText: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: tokens.space[12],
  },
  emptyActionItem: {
    flex: 1,
  },
  statStrip: {
    flexDirection: 'row',
    gap: tokens.space[8],
  },
  statPill: {
    flex: 1,
    paddingHorizontal: tokens.space[8],
    paddingVertical: tokens.space[8],
    borderRadius: tokens.radius[12],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.surface,
    gap: tokens.space[4],
  },
  statPillValue: {
    fontSize: tokens.font.size[16],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
  },
  statPillLabel: {
    fontSize: tokens.font.size[10],
    color: tokens.color.textFaint,
  },
  blueprintCard: {
    padding: tokens.space[16],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.surface2,
    borderRadius: tokens.radius[12],
    gap: tokens.space[12],
  },
  blueprintTitle: {
    fontSize: tokens.font.size[14],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
  },
  blueprintSubtitle: {
    fontSize: tokens.font.size[12],
    lineHeight: 18,
    color: tokens.color.textMuted,
  },
  stackMini: {
    gap: tokens.space[8],
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.space[8],
    padding: tokens.space[12],
    borderRadius: tokens.radius[12],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.surface,
  },
  progressIndexPill: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.surface3,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  progressIndexText: {
    fontSize: tokens.font.size[12],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
  },
  progressBody: {
    flex: 1,
    gap: tokens.space[4],
  },
  progressTitle: {
    fontSize: tokens.font.size[12],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
  },
  progressMeta: {
    fontSize: tokens.font.size[10],
    color: tokens.color.textFaint,
  },
  progressNote: {
    fontSize: tokens.font.size[12],
    lineHeight: 18,
    color: tokens.color.textMuted,
  },
  chapterStack: {
    gap: tokens.space[12],
  },
  chapterCard: {
    padding: tokens.space[16],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius[12],
    gap: tokens.space[8],
  },
  chapterCardNext: {
    borderColor: tokens.color.accentRing,
    backgroundColor: tokens.color.accentSoft,
  },
  chapterTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.space[8],
  },
  chapterIndexPill: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.surface2,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  chapterIndexText: {
    fontSize: tokens.font.size[12],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
  },
  chapterCopy: {
    flex: 1,
    gap: tokens.space[4],
  },
  chapterTitle: {
    fontSize: tokens.font.size[14],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
  },
  chapterMeta: {
    fontSize: tokens.font.size[10],
    color: tokens.color.textFaint,
  },
  chapterNote: {
    fontSize: tokens.font.size[12],
    lineHeight: 18,
    color: tokens.color.textMuted,
  },
  outputCard: {
    padding: tokens.space[12],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    borderRadius: tokens.radius[12],
    backgroundColor: tokens.color.surface2,
    gap: tokens.space[4],
  },
  outputCardEmpty: {
    padding: tokens.space[12],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    borderRadius: tokens.radius[12],
    backgroundColor: tokens.color.surface2,
    gap: tokens.space[4],
  },
  outputEyebrow: {
    fontSize: tokens.font.size[10],
    fontWeight: tokens.font.weight.bold,
    color: tokens.color.textFaint,
    letterSpacing: 0.8,
  },
  outputTitle: {
    fontSize: tokens.font.size[14],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
  },
  outputMeta: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
  },
  variantStack: {
    gap: tokens.space[8],
  },
  variantHeading: {
    fontSize: tokens.font.size[10],
    color: tokens.color.textFaint,
    fontWeight: tokens.font.weight.semibold,
  },
  blueprintGrid: {
    flexDirection: 'row',
    gap: tokens.space[8],
  },
  blueprintNode: {
    flex: 1,
    padding: tokens.space[12],
    borderRadius: tokens.radius[12],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.surface,
    gap: tokens.space[8],
  },
  blueprintEyebrow: {
    fontSize: tokens.font.size[10],
    fontWeight: tokens.font.weight.bold,
    color: tokens.color.textFaint,
    letterSpacing: 1,
  },
  blueprintNodeTitle: {
    fontSize: tokens.font.size[12],
    color: tokens.color.text,
    lineHeight: 18,
  },
  stickyRow: {
    flexDirection: 'row',
    gap: tokens.space[12],
  },
  stickyItem: {
    flex: 1,
  },
  hiddenChaptersCard: {
    marginTop: tokens.space[16],
    padding: tokens.space[16],
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: tokens.radius[8],
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenChaptersText: {
    color: tokens.color.textMuted,
    fontSize: tokens.font.size[14],
    fontWeight: tokens.font.weight.medium,
  },
  softProbeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.color.accent,
    borderWidth: 1,
    borderColor: tokens.color.brand + '40',
    padding: tokens.space[16],
    borderRadius: tokens.radius[12],
    marginBottom: tokens.space[16],
    gap: tokens.space[12],
  },
  softProbeIconRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: tokens.color.brand + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  softProbeTitle: {
    fontSize: tokens.font.size[10],
    color: tokens.color.brand,
    fontWeight: tokens.font.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: tokens.space[4],
  },
  softProbeText: {
    fontSize: tokens.font.size[14],
    color: tokens.color.surface,
    fontWeight: tokens.font.weight.medium,
  },
});
