import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { RootStackParamList } from '../navigation/types';
import { generateDraft } from '../api/alibiApi';
import { useAppStore } from '../store/store';
import type { StudioMode } from '../store/types';
import { Button } from '../components/Button';
import { ModeStrip } from '../components/ModeStrip';
import { ScreenLayout } from '../components/ScreenLayout';
import { ScribbleMic } from '../components/ScribbleMic';
import { Section } from '../components/Section';
import { getLayoutMetrics } from '../theme/layout';
import { tokens } from '../theme/tokens';
import { normalizeDraftContentForFormat } from '../utils/draftFormatting';
import { makeId } from '../utils/id';
import { buildNarrativeProgress, narrativeStepPreview } from '../utils/narrativeProgress';
import { buildContinuityPacket } from '../utils/projectMemory';
import { triggerSoftFeedback } from '../utils/feedback';

type Props = NativeStackScreenProps<RootStackParamList, 'Studio'>;

const interviewPrompts = [
  'What does the protagonist want that they won’t admit?',
  'What rule does this world enforce that changes everything?',
  'What is the emotional promise of this book (in one sentence)?',
];

const interviewPromptPurpose: Record<string, string> = {
  'What does the protagonist want that they won’t admit?': 'This reveals hidden pressure and motivation.',
  'What rule does this world enforce that changes everything?': 'This defines the system the story has to obey.',
  'What is the emotional promise of this book (in one sentence)?': 'This sets the feeling the project should keep returning to.',
};

export function StudioScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const { state, dispatch } = useAppStore();
  const { width, height } = useWindowDimensions();
  const metrics = getLayoutMetrics(width, height);
  const project = state.projects[projectId];
  const mode = (state.studio.modeByProjectId[projectId] ?? 'interview') as StudioMode;
  const [isGenerating, setIsGenerating] = useState(false);
  const isCompact = width < 390;
  const passTitle = project?.type === 'book' ? 'Chapter draft' : 'Writing draft';
  const passButtonLabel = project?.type === 'book' ? 'Build chapter draft' : 'Build writing draft';
  const draftStyle = state.studio.draftStyleByProjectId[projectId] ?? { tone: 'neutral', distance: 'close', targetOutlineItemId: undefined };
  const narrativeProgress = useMemo(
    () => buildNarrativeProgress({ project, draftsById: state.drafts }),
    [project, state.drafts],
  );
  const outline = project?.type === 'book' ? narrativeProgress.steps : [];
  const selectableOutline = React.useMemo(
    () => outline.filter((item) => item.draftCount > 0 || item.isSuggestedNext),
    [outline],
  );
  const suggestedOutlineItem = project?.type === 'book' ? narrativeProgress.nextSuggestedStep : undefined;
  const selectedOutlineItem = selectableOutline.find((item) => item.id === draftStyle.targetOutlineItemId) ?? suggestedOutlineItem;

  React.useEffect(() => {
    if (!draftStyle.targetOutlineItemId) return;
    if (selectableOutline.some((item) => item.id === draftStyle.targetOutlineItemId)) return;
    dispatch({ type: 'studio.setDraftStyle', payload: { projectId, targetOutlineItemId: undefined } });
  }, [dispatch, draftStyle.targetOutlineItemId, projectId, selectableOutline]);
  const continuity = useMemo(
    () => buildContinuityPacket({ project, draftsById: state.drafts, targetOutlineItemId: draftStyle.targetOutlineItemId }),
    [draftStyle.targetOutlineItemId, project, state.drafts],
  );
  const sourceEntries = useMemo(
    () => (project?.entryIds ?? []).map((id) => state.entries[id]).filter(Boolean),
    [project?.entryIds, state.entries],
  );
  const extractedSourceCount = sourceEntries.filter((entry) => entry.status === 'extracted').length;
  const transcriptLength = sourceEntries.reduce((acc, entry) => acc + (entry.transcript?.length ?? 0), 0);
  const sourceScore = Math.min(60, Math.floor(transcriptLength / 80));
  const canonCount = project?.type === 'book' ? project.book?.canon.length ?? 0 : 0;
  const outlineCount = project?.type === 'book' ? narrativeProgress.total : 0;
  const passCount = project?.draftIds.length ?? 0;
  const contextScore = Math.min(100, sourceScore + (canonCount * 5) + outlineCount * 2 + passCount * 4 + (selectedOutlineItem ? 4 : 0));
  const contextLabel = contextScore >= 78 ? 'Healthy' : contextScore >= 48 ? 'Building' : 'Thin';
  const contextNote = contextScore >= 78
    ? 'There is enough context here to push into a real draft without guessing too hard.'
    : contextScore >= 48
      ? 'The project has traction, but a little more entry material or memory would make the draft steadier.'
      : 'The project is still light on usable context. Capture or pin more before expecting a strong draft.';
  const canBuildDraft = contextScore >= 48 && extractedSourceCount > 0;

  useEffect(() => {
    if (project?.type !== 'book') return;
    if (project.book?.outline?.length) return;
    dispatch({ type: 'book.materializeNarrativeOutline', payload: { projectId } });
  }, [dispatch, project?.book?.outline?.length, project?.type, projectId]);

  const modeGuide = useMemo(() => {
    if (mode === 'interview') {
      return {
        eyebrow: 'WHAT TO DO NOW',
        title: 'Capture material worth reusing.',
        copy: 'Use intake to collect motive, conflict, rules, scenes, and pressure. The goal is real entry material, not filler.',
        primaryLabel: 'Record into project',
        primaryAction: () => navigation.navigate('Recording', { source: 'studio', projectId, returnTo: 'studio' }),
        secondaryLabel: 'Type entry',
        secondaryAction: () => navigation.navigate('TypeNote', { source: 'studio', projectId, returnTo: 'studio' }),
      };
    }

    if (mode === 'outline') {
      return {
        eyebrow: 'WHAT TO DO NOW',
        title: 'Turn entries into clean story steps.',
        copy: 'Use this only to understand where the story is and what the next chapter needs to carry. Keep it simple.',
        primaryLabel: 'Open outline workspace',
        primaryAction: () => navigation.navigate('ProjectSettings', { projectId, focusSection: 'outline' }),
        secondaryLabel: 'Open story memory',
        secondaryAction: () => navigation.navigate('ProjectSettings', { projectId, focusSection: 'canon' }),
      };
    }

    return {
      eyebrow: 'WHAT TO DO NOW',
      title: selectedOutlineItem ? `Build the draft for ${selectedOutlineItem.title}.` : 'Build the next serious draft.',
      copy: 'This is where the next chapter output gets built. Either move the story forward or deepen the selected chapter.',
      primaryLabel: passButtonLabel,
      primaryAction: () => {
        if (!canBuildDraft) return;
        if (isGenerating) return;
        setIsGenerating(true);
        const draftId = makeId('draft');
        const format = project?.type === 'book' ? 'book-chapter' : 'essay';
        const title = project?.type === 'book' ? 'Chapter Draft' : 'Draft';
        const entries = (project?.entryIds ?? []).map((id) => state.entries[id]).filter(Boolean).slice(0, 12).map((e) => ({ title: e.title, transcript: e.transcript, highlights: e.highlights }));
        const canon = project?.type === 'book' ? (project.book?.canon ?? []).slice(0, 24).map((c) => ({ kind: c.kind, title: c.title, detail: c.detail })) : [];
        generateDraft({ projectName: project?.name ?? 'Untitled project', format, brief: project?.type === 'book' ? project.book?.brief : undefined, tone: draftStyle.tone, distance: draftStyle.distance, target: selectedOutlineItem ? { title: selectedOutlineItem.title, note: selectedOutlineItem.note } : undefined, sources: entries, canon, continuity, voice: { enabled: state.settings.ashtonModeEnabled, notes: state.settings.ashtonVoiceNotes } }).then((result) => { dispatch({ type: 'draft.create', payload: { draftId, projectId, entryIds: project?.entryIds ?? [], format, title: selectedOutlineItem?.title ?? title, content: result.ok ? normalizeDraftContentForFormat(format, result.content) : '(Draft generation failed.)', tone: draftStyle.tone, distance: draftStyle.distance, targetOutlineItemId: selectedOutlineItem?.id } }); navigation.navigate('Output', { draftId }); }).finally(() => setIsGenerating(false));
      },
      secondaryLabel: 'Record more entries',
      secondaryAction: () => navigation.navigate('Recording', { source: 'studio', projectId, returnTo: 'studio' }),
    };
  }, [canBuildDraft, continuity, dispatch, draftStyle.distance, draftStyle.targetOutlineItemId, draftStyle.tone, isGenerating, mode, navigation, passButtonLabel, project?.book?.brief, project?.book?.canon, project?.entryIds, project?.name, project?.type, projectId, selectedOutlineItem, state.entries, state.settings.ashtonModeEnabled, state.settings.ashtonVoiceNotes]);

  const sticky = useMemo(() => {
    const primaryLabel = mode === 'interview' ? 'Capture answer' : mode === 'draft' ? passButtonLabel : 'Open outline workspace';
    return (
      <View style={styles.stickyRow}>
        <View style={styles.stickyItem}>
          <Button label="Entries" variant="secondary" onPress={() => navigation.navigate('SelectEntries', { projectId })} />
        </View>
        <View style={styles.stickyItem}>
          <Button
            label={primaryLabel}
            disabled={mode === 'draft' ? isGenerating || !canBuildDraft : false}
            onPress={() => {
              if (mode === 'draft') {
                if (!canBuildDraft) return;
                if (isGenerating) return;
                setIsGenerating(true);
                const draftId = makeId('draft');
                const format = project?.type === 'book' ? 'book-chapter' : 'essay';
                const title = project?.type === 'book' ? 'Chapter Draft' : 'Draft';

                const entries = (project?.entryIds ?? [])
                  .map((id) => state.entries[id])
                  .filter(Boolean)
                  .slice(0, 12)
                  .map((e) => ({
                    title: e.title,
                    transcript: e.transcript,
                    highlights: e.highlights,
                  }));

                const canon =
                  project?.type === 'book'
                    ? (project.book?.canon ?? []).slice(0, 24).map((c) => ({ kind: c.kind, title: c.title, detail: c.detail }))
                    : [];

                generateDraft({
                  projectName: project?.name ?? 'Untitled project',
                  format,
                  brief: project?.type === 'book' ? project.book?.brief : undefined,
                  tone: draftStyle.tone,
                  distance: draftStyle.distance,
                  target: selectedOutlineItem ? { title: selectedOutlineItem.title, note: selectedOutlineItem.note } : undefined,
                  sources: entries,
                  canon,
                  continuity,
                  voice: { enabled: state.settings.ashtonModeEnabled, notes: state.settings.ashtonVoiceNotes },
                })
                  .then((result) => {
                    dispatch({
                      type: 'draft.create',
                      payload: {
                        draftId,
                        projectId,
                        entryIds: project?.entryIds ?? [],
                        format,
                        title: selectedOutlineItem?.title ?? title,
                        content: result.ok ? normalizeDraftContentForFormat(format, result.content) : '(Draft generation failed.)',
                        tone: draftStyle.tone,
                        distance: draftStyle.distance,
                        targetOutlineItemId: selectedOutlineItem?.id,
                      },
                    });
                    navigation.navigate('Output', { draftId });
                  })
                  .finally(() => setIsGenerating(false));
              }
              if (mode === 'outline' && project?.type === 'book') {
                navigation.navigate('ProjectSettings', { projectId, focusSection: 'outline' });
              }
            }}
          />
        </View>
      </View>
    );
  }, [canBuildDraft, continuity, dispatch, draftStyle.distance, draftStyle.targetOutlineItemId, draftStyle.tone, isGenerating, mode, navigation, passButtonLabel, project?.book?.brief, project?.book?.canon, project?.entryIds, project?.name, project?.type, projectId, selectedOutlineItem, state.entries, state.settings.ashtonModeEnabled, state.settings.ashtonVoiceNotes]);

  if (!project) {
    return (
      <ScreenLayout title="Studio">
        <Text style={styles.muted}>Project not found.</Text>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout title="Studio" topRight={<Pressable onPress={() => navigation.navigate('ProjectSettings', { projectId })}><Ionicons name="settings-outline" size={24} color={tokens.color.brand} /></Pressable>} >
      <ScrollView contentContainerStyle={styles.scroll}>
        <ModeStrip value={mode} onChange={(m) => dispatch({ type: 'studio.setMode', payload: { projectId, mode: m } })} />

        <View style={styles.modeCard}>
          <Text style={styles.modeCardEyebrow}>{mode === 'interview' ? 'INTAKE' : mode === 'outline' ? 'STRUCTURE' : 'WRITING'}</Text>
          <Text style={styles.modeCardTitle}>{mode === 'interview' ? 'Collect material that can actually support the project.' : mode === 'outline' ? 'Turn entries into sequence, pressure, and movement.' : `Turn entries and structure into a real ${passTitle.toLowerCase()}.`}</Text>
          <Text style={styles.modeCardText}>{mode === 'interview' ? 'Use this mode to uncover motives, rules, scenes, and tensions. The goal is not just to talk — it is to generate reusable entries.' : mode === 'outline' ? 'Outline mode is where existing material gets arranged into steps, turns, chapters, or sections. Use the outline workspace to shape it. Record more only when a step has no real entry underneath it.' : `A ${passTitle.toLowerCase()} should be the next serious attempt at form, not a vague output. It should know which entries it is drawing from and what it is trying to become.`}</Text>
        </View>

        <View style={styles.contextMeterCard}>
          <View style={styles.contextMeterHeader}>
            <View>
              <Text style={styles.contextMeterEyebrow}>Context health</Text>
              <Text style={styles.contextMeterTitle}>{contextLabel} context</Text>
            </View>
            <View style={styles.contextMeterScorePill}>
              <Text style={styles.contextMeterScoreText}>{contextScore}%</Text>
            </View>
          </View>
          <View style={styles.contextRail}>
            <View style={[styles.contextFill, { width: `${Math.max(8, contextScore)}%` }]} />
          </View>
          <Text style={styles.contextMeterNote}>{contextNote}</Text>
          <View style={styles.contextStatRow}>
            <View style={styles.contextStatCard}>
              <Text style={styles.contextStatValue}>{extractedSourceCount}</Text>
              <Text style={styles.contextStatLabel}>Ready entries</Text>
            </View>
            <View style={styles.contextStatCard}>
              <Text style={styles.contextStatValue}>{canonCount}</Text>
              <Text style={styles.contextStatLabel}>Pinned memory</Text>
            </View>
            <View style={styles.contextStatCard}>
              <Text style={styles.contextStatValue}>{outlineCount}</Text>
              <Text style={styles.contextStatLabel}>Outline steps</Text>
            </View>
            <View style={styles.contextStatCard}>
              <Text style={styles.contextStatValue}>{passCount}</Text>
              <Text style={styles.contextStatLabel}>Drafts</Text>
            </View>
          </View>
        </View>

        <View style={styles.modeGuideCard}>
          <Text style={styles.modeGuideEyebrow}>{modeGuide.eyebrow}</Text>
          <Text style={styles.modeGuideTitle}>{modeGuide.title}</Text>
          <Text style={styles.modeGuideCopy}>{modeGuide.copy}</Text>
          <View style={styles.modeGuideActions}>
            <View style={styles.modeGuideActionItem}>
              <Button label={modeGuide.primaryLabel} onPress={modeGuide.primaryAction} disabled={mode === 'draft' ? isGenerating : false} />
            </View>
            <View style={styles.modeGuideActionItem}>
              <Button label={modeGuide.secondaryLabel} variant="secondary" onPress={modeGuide.secondaryAction} />
            </View>
          </View>
        </View>

        {mode === 'interview' ? (
          <Section title="Material intake">
            <View style={styles.blueprintCard}>
              <Text style={styles.cardTitle}>Good intake creates entries, not filler.</Text>
              <Text style={styles.cardMeta}>Speak concretely. Name tensions, contradictions, scenes, motives, and rules you can reuse later in structure and drafting.</Text>
            </View>
            {interviewPrompts.map((q) => (
              <View key={q} style={styles.card}>
                <Text style={styles.cardTitle}>{q}</Text>
                <Text style={styles.cardMeta}>{interviewPromptPurpose[q] ?? 'Answer by voice or type.'}</Text>
              </View>
            ))}
          </Section>
        ) : null}

        

        {mode === 'outline' ? (
          <Section title="Chapter path">
            <View style={styles.blueprintCard}>
              <Text style={styles.cardTitle}>This should answer one quiet question: where are we in the story?</Text>
              <Text style={styles.cardMeta}>Open the narrative path, inspect the next chapter, and only add entries if that chapter still has nothing real under it.</Text>
            </View>
            {outline.length ? (
              outline.slice(0, 5).map((o, index) => (
                <View key={o.id} style={styles.card}>
                  <Text style={styles.cardTitle}>{`${index + 1}. ${o.title}`}</Text>
                  <Text style={styles.cardMeta}>{o.note ? o.note : 'Add the action, pressure, or turn this chapter needs to carry.'}</Text>
                </View>
              ))
            ) : (
              <View style={styles.blueprintCard}>
                <Text style={styles.cardTitle}>The path will form as the project grows.</Text>
                <Text style={styles.cardMeta}>Keep the structure light. The point is to know the next meaningful chapter, not to manage a wall of tasks.</Text>
              </View>
            )}
          </Section>
        ) : null}

        {mode === 'draft' ? (
          <Section title={project.type === 'book' ? 'Chapter output' : passTitle}>
            <View style={styles.setupCard}>
              <Text style={styles.cardTitle}>{project.type === 'book' ? 'Current chapter target' : 'Draft target'}</Text>
              <Text style={styles.cardMeta}>
                {continuity?.summary ?? `${sourceEntries.length} entries are ready for this draft.`}
              </Text>
              {project?.type === 'book' && suggestedOutlineItem ? (
                <View style={styles.thresholdCard}>
                  <Text style={styles.thresholdTitle}>Narrative progression</Text>
                  <Text style={styles.thresholdText}>{`Next suggested part: ${suggestedOutlineItem.title}. ${narrativeStepPreview(suggestedOutlineItem)}`}</Text>
                </View>
              ) : null}
              {!canBuildDraft ? (
                <View style={styles.thresholdCard}>
                  <Text style={styles.thresholdTitle}>Context threshold not met yet</Text>
                  <Text style={styles.thresholdText}>Keep feeding entries, story memory, or outline detail until the context health is at least building. Then drafting becomes much more reliable.</Text>
                </View>
              ) : null}
              {selectableOutline.length ? (
                <View style={styles.targetWrap}>
                  <Pressable
                    onPress={() => dispatch({ type: 'studio.setDraftStyle', payload: { projectId, targetOutlineItemId: undefined } })}
                    style={[styles.targetChip, !draftStyle.targetOutlineItemId ? styles.targetChipActive : null]}
                  >
                    <Text style={[styles.targetChipText, !draftStyle.targetOutlineItemId ? styles.targetChipTextActive : null]}>Auto-place in story path</Text>
                  </Pressable>
                  {selectableOutline.map((item, index) => (
                    <Pressable
                      key={item.id}
                      onPress={() => dispatch({ type: 'studio.setDraftStyle', payload: { projectId, targetOutlineItemId: item.id } })}
                      style={[styles.targetChip, draftStyle.targetOutlineItemId === item.id ? styles.targetChipActive : null]}
                    >
                      <Text style={[styles.targetChipText, draftStyle.targetOutlineItemId === item.id ? styles.targetChipTextActive : null]}>{`${item.index + 1}. ${item.title}`}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {continuity?.driftRisks?.length ? (
                <View style={styles.signalStack}>
                  {continuity.driftRisks.slice(0, 3).map((item) => (
                    <Text key={item} style={styles.signalLine}>• {item}</Text>
                  ))}
                </View>
              ) : null}
              {continuity?.priorPasses?.length ? (
                <View style={styles.signalStack}>
                  <Text style={styles.cardMeta}>Recent drafts already in frame</Text>
                  {continuity.priorPasses.map((item) => (
                    <View key={`${item.title}:${item.summary}`} style={styles.passRow}>
                      <Text style={styles.passTitle}>{item.targetTitle ?? item.title}</Text>
                      <Text style={styles.passMeta}>{item.summary}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
            <View style={{ marginBottom: 16 }}>
              <Button label={isGenerating ? 'Generating...' : passButtonLabel} disabled={isGenerating || !canBuildDraft} onPress={() => {
                if (!canBuildDraft) return;
                if (isGenerating) return;
                setIsGenerating(true);
                const draftId = makeId('draft');
                const format = project?.type === 'book' ? 'book-chapter' : 'essay';
                const title = project?.type === 'book' ? 'Chapter Draft' : 'Draft';
                const entries = (project?.entryIds ?? []).map((id) => state.entries[id]).filter(Boolean).slice(0, 12).map((e) => ({ title: e.title, transcript: e.transcript, highlights: e.highlights }));
                const canon = project?.type === 'book' ? (project.book?.canon ?? []).slice(0, 24).map((c) => ({ kind: c.kind, title: c.title, detail: c.detail })) : [];
                generateDraft({ projectName: project?.name ?? 'Untitled project', format, brief: project?.type === 'book' ? project.book?.brief : undefined, tone: draftStyle.tone, distance: draftStyle.distance, target: selectedOutlineItem ? { title: selectedOutlineItem.title, note: selectedOutlineItem.note } : undefined, sources: entries, canon, continuity, voice: { enabled: state.settings.ashtonModeEnabled, notes: state.settings.ashtonVoiceNotes } }).then((result) => { dispatch({ type: 'draft.create', payload: { draftId, projectId, entryIds: project?.entryIds ?? [], format, title: selectedOutlineItem?.title ?? title, content: result.ok ? normalizeDraftContentForFormat(format, result.content) : '(Draft generation failed.)', tone: draftStyle.tone, distance: draftStyle.distance, targetOutlineItemId: selectedOutlineItem?.id } }); navigation.navigate('Output', { draftId }); }).finally(() => setIsGenerating(false));
              }} />
            </View>
          </Section>
        ) : null}
      </ScrollView>

      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <View style={[styles.studioMicWrap, { right: 18, bottom: metrics.bottomNavHeight + 18 }]}> 
          <Pressable
            hitSlop={16}
            onPress={() => {
              triggerSoftFeedback();
              if (state.auth.status !== 'signedIn' || !state.auth.userId) {
                navigation.navigate('Auth');
                return;
              }
              navigation.navigate('Recording', { source: 'studio', projectId, returnTo: 'studio' });
            }}
          >
            <ScribbleMic size={76} iconSize={26} aggressive />
          </Pressable>
        </View>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  topMeta: {
    fontSize: tokens.font.size[12],
    color: '#6A6A6A',
    maxWidth: 180,
  },
  scroll: {
    paddingBottom: tokens.space[24],
    gap: tokens.space[16],
  },
  studioMicWrap: {
    position: 'absolute',
    zIndex: 40,
    elevation: 6,
  },
  modeCard: {
    padding: tokens.space[16],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    borderRadius: tokens.radius[16],
    backgroundColor: tokens.color.surface2,
    gap: tokens.space[8],
  },
  modeCardEyebrow: {
    fontSize: tokens.font.size[10],
    color: tokens.color.textFaint,
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 1,
  },
  modeCardTitle: {
    fontSize: tokens.font.size[16],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
    lineHeight: 22,
  },
  modeCardText: {
    fontSize: 13,
    color: tokens.color.textMuted,
    lineHeight: 19,
  },
  card: {
    padding: tokens.space[16],
    borderWidth: 1,
    borderColor: '#E6E6E6',
    borderRadius: tokens.radius[12],
    gap: tokens.space[8],
  },
  cardTitle: {
    fontSize: tokens.font.size[14],
    fontWeight: tokens.font.weight.semibold,
    color: '#111111',
  },
  cardMeta: {
    fontSize: tokens.font.size[12],
    color: '#6A6A6A',
  },
  muted: {
    fontSize: tokens.font.size[12],
    color: '#6A6A6A',
  },
  blueprintCard: {
    padding: tokens.space[16],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    borderRadius: tokens.radius[12],
    backgroundColor: tokens.color.surface2,
    gap: tokens.space[12],
  },
  contextMeterCard: {
    padding: tokens.space[16],
    borderWidth: 1,
    borderColor: 'rgba(255, 56, 35, 0.18)',
    borderRadius: tokens.radius[16],
    backgroundColor: '#FFF6F2',
    gap: tokens.space[12],
  },
  contextMeterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space[12],
  },
  contextMeterEyebrow: {
    fontSize: tokens.font.size[10],
    color: '#C2410C',
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  contextMeterTitle: {
    fontSize: tokens.font.size[16],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
  },
  contextMeterScorePill: {
    paddingHorizontal: tokens.space[12],
    paddingVertical: tokens.space[8],
    borderRadius: 999,
    backgroundColor: 'rgba(255, 56, 35, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 56, 35, 0.22)',
  },
  contextMeterScoreText: {
    fontSize: tokens.font.size[12],
    fontWeight: tokens.font.weight.semibold,
    color: '#C2410C',
  },
  contextRail: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 56, 35, 0.08)',
    overflow: 'hidden',
  },
  contextFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: tokens.color.brand,
  },
  contextMeterNote: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
    lineHeight: 18,
  },
  contextStatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space[8],
  },
  contextStatCard: {
    minWidth: '47%',
    flex: 1,
    padding: tokens.space[12],
    borderRadius: tokens.radius[12],
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 56, 35, 0.1)',
    gap: 4,
  },
  contextStatValue: {
    fontSize: tokens.font.size[16],
    color: tokens.color.text,
    fontWeight: tokens.font.weight.semibold,
  },
  contextStatLabel: {
    fontSize: tokens.font.size[10],
    color: tokens.color.textMuted,
    fontWeight: tokens.font.weight.medium,
  },
  modeGuideCard: {
    padding: tokens.space[16],
    borderWidth: 1,
    borderColor: 'rgba(17, 17, 17, 0.08)',
    borderRadius: tokens.radius[16],
    backgroundColor: '#FFFFFF',
    gap: tokens.space[12],
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  modeGuideEyebrow: {
    fontSize: tokens.font.size[10],
    color: tokens.color.brand,
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  modeGuideTitle: {
    fontSize: tokens.font.size[18],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
    lineHeight: 24,
  },
  modeGuideCopy: {
    fontSize: tokens.font.size[14],
    color: tokens.color.textMuted,
    lineHeight: 20,
  },
  modeGuideBulletStack: {
    gap: tokens.space[8],
  },
  modeGuideBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.space[8],
  },
  modeGuideBulletDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: tokens.color.brand,
    marginTop: 5,
  },
  modeGuideBulletText: {
    flex: 1,
    fontSize: tokens.font.size[12],
    color: tokens.color.text,
    lineHeight: 18,
  },
  modeGuideActions: {
    flexDirection: 'row',
    gap: tokens.space[12],
  },
  modeGuideActionItem: {
    flex: 1,
  },
  setupCard: {
    padding: tokens.space[16],
    borderWidth: 1,
    borderColor: tokens.color.accentRing,
    borderRadius: tokens.radius[12],
    backgroundColor: tokens.color.accentSoft,
    gap: tokens.space[12],
  },
  thresholdCard: {
    padding: tokens.space[12],
    borderRadius: tokens.radius[12],
    borderWidth: 1,
    borderColor: tokens.color.accentRing,
    backgroundColor: tokens.color.surface,
    gap: tokens.space[8],
  },
  thresholdTitle: {
    fontSize: tokens.font.size[12],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
  },
  thresholdText: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
    lineHeight: 18,
  },
  previewRow: {
    flexDirection: 'row',
    gap: tokens.space[8],
  },
  previewRowCompact: {
    flexDirection: 'column',
  },
  previewBeat: {
    flex: 1,
    minWidth: 0,
    padding: tokens.space[12],
    borderRadius: tokens.radius[12],
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    gap: tokens.space[8],
  },
  previewBeatEyebrow: {
    fontSize: tokens.font.size[10],
    fontWeight: tokens.font.weight.bold,
    color: tokens.color.textFaint,
    letterSpacing: 1,
  },
  previewBeatTitle: {
    fontSize: tokens.font.size[12],
    color: tokens.color.text,
    lineHeight: 18,
    flexShrink: 1,
  },
  targetWrap: {
    gap: tokens.space[8],
  },
  targetChip: {
    paddingVertical: tokens.space[8],
    paddingHorizontal: tokens.space[12],
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: 'rgba(255,255,255,0.58)',
  },
  targetChipActive: {
    borderColor: tokens.color.accentRing,
    backgroundColor: '#FFFFFF',
  },
  targetChipText: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
    fontWeight: tokens.font.weight.medium,
    flexShrink: 1,
  },
  targetChipTextActive: {
    color: tokens.color.accent,
    fontWeight: tokens.font.weight.semibold,
  },
  signalStack: {
    gap: tokens.space[8],
  },
  signalLine: {
    fontSize: tokens.font.size[12],
    color: tokens.color.text,
    lineHeight: 18,
  },
  passRow: {
    padding: tokens.space[12],
    borderRadius: tokens.radius[12],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: 'rgba(255,255,255,0.72)',
    gap: tokens.space[4],
  },
  passTitle: {
    fontSize: tokens.font.size[12],
    color: tokens.color.text,
    fontWeight: tokens.font.weight.semibold,
  },
  passMeta: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
    lineHeight: 18,
  },
  stickyRow: {
    flexDirection: 'row',
    gap: tokens.space[12],
  },
  stickyItem: {
    flex: 1,
  },
});
