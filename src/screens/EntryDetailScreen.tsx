import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { RootStackParamList } from '../navigation/types';
import { extractEntry } from '../api/alibiApi';
import { Button } from '../components/Button';
import { ScreenLayout } from '../components/ScreenLayout';
import { Section } from '../components/Section';
import { EntryAudioPlayer } from '../components/EntryAudioPlayer';
import { buildProjectProfiles, deriveCaptureContext, formatDecisionNextStep, formatDecisionRole } from '../intelligence/recordingIntelligence';
import { tokens } from '../theme/tokens';
import { useAppStore } from '../store/store';
import { makeId } from '../utils/id';

type Props = NativeStackScreenProps<RootStackParamList, 'EntryDetail'>;

export function EntryDetailScreen({ route, navigation }: Props) {
  const { entryId, autoExtract } = route.params;
  const { state, dispatch } = useAppStore();
  const entry = state.entries[entryId];

  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false);
  const autoExtractAttemptedRef = React.useRef<string | null>(null);
  const projectProfiles = useMemo(() => buildProjectProfiles(state), [state]);
  const linkedDraft = useMemo(
    () => Object.values(state.drafts).find((draft) => draft.entryIds.includes(entryId)),
    [entryId, state.drafts],
  );

  useEffect(() => {
    setIsExtracting(false);
    setError(null);
    autoExtractAttemptedRef.current = null;
  }, [entryId]);

  useEffect(() => {
    if (!entry || entry.status !== 'captured' || isExtracting) return;
    if (autoExtractAttemptedRef.current === entry.id) return;

    if (autoExtract || entry.kind === 'voice' || Boolean(entry.transcript?.trim())) {
      autoExtractAttemptedRef.current = entry.id;
      void handleExtract();
    }
  }, [autoExtract, entry, isExtracting]);

  const canGenerate = entry?.status === 'extracted';

  async function handleExtract() {
    if (!entry || isExtracting) return;

    setError(null);
    setIsExtracting(true);
    dispatch({ type: 'entry.setStatus', payload: { entryId: entry.id, status: 'processing' } });

    const result = await extractEntry({
      title: entry.title,
      transcript: entry.transcript ?? '',
      intent: entry.intent,
      targetFormat: entry.targetFormat,
      captureContext: deriveCaptureContext(entry.projectId, linkedDraft?.id),
      contextAnchor: {
        projectId: entry.projectId,
        projectName: entry.projectId ? state.projects[entry.projectId]?.name : undefined,
        draftId: linkedDraft?.id,
        draftTitle: linkedDraft?.title,
      },
      projectProfiles,
    });

    if (!result.ok) {
      dispatch({ type: 'entry.setStatus', payload: { entryId: entry.id, status: 'captured' } });
      setError(result.error);
      setIsExtracting(false);
      return;
    }

    dispatch({
      type: 'entry.setExtraction',
      payload: {
        entryId: entry.id,
        transcript: result.transcript,
        highlights: result.highlights,
        themes: result.themes,
        ideas: result.ideas,
        captureContext: result.captureContext,
        decision: result.decision,
      },
    });
    if (!entry.projectId && result.decision?.autoAssigned && result.decision.primaryProjectId) {
      dispatch({ type: 'project.addEntry', payload: { projectId: result.decision.primaryProjectId, entryId: entry.id } });
    }
    setIsExtracting(false);
  }

  const sticky = useMemo(() => {
    if (!entry) return null;
    return (
      <View style={styles.stickyRow}>
        <View style={styles.stickyItem}>
          <Button label="Add to Project" variant="secondary" onPress={() => navigation.navigate('SelectProject', { entryId: entry.id })} />
        </View>
        {entry.status === 'extracted' ? (
          <View style={styles.stickyItem}>
            <Button
              label="Quick Output (Standalone)"
              onPress={() => {
                if (canGenerate) {
                  const draftId = makeId('draft');
                  const format = entry.targetFormat ?? 'essay';
                  dispatch({
                    type: 'draft.create',
                    payload: {
                      draftId,
                      projectId: entry.projectId,
                      entryIds: [entry.id],
                      format,
                      title: 'Draft — from entry',
                      content: '(Placeholder draft generated from selected sources.)',
                    },
                  });
                  navigation.navigate('Output', { draftId });
                }
              }}
            />
          </View>
        ) : null}
      </View>
    );
  }, [canGenerate, dispatch, entry, navigation]);

  if (!entry) {
    return (
      <ScreenLayout title="Entry">
        <Text style={styles.muted}>Entry not found.</Text>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      title="Entry"
      topRight={<Text style={styles.topMeta}>{entry.status === 'processing' ? 'Processing…' : entry.status}</Text>}
      stickyBottom={sticky}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerCard}>
          <Text style={styles.headerEyebrow}>Captured entry</Text>
          <Text style={styles.entryTitle}>{entry.title}</Text>
          <Text style={styles.entryMeta}>{new Date(entry.createdAt).toLocaleString()}</Text>
          <View style={styles.metaRow}>
            <MetaPill icon="document-text-outline" label={entry.kind} />
            <MetaPill icon="sparkles-outline" label={entry.status} />
            {entry.projectId ? <MetaPill icon="folder-open-outline" label="In project" /> : <MetaPill icon="albums-outline" label="Standalone" />}
          </View>
        </View>

        {entry.decision ? (
          <View style={styles.primaryActionCard}>
            <Text style={styles.primaryActionTitle}>System read</Text>
            <Text style={styles.primaryActionSubtitle}>
              {formatDecisionRole(entry.decision.contentRole)} • {entry.decision.primaryProjectName ?? 'No project match yet'} • {formatDecisionNextStep(entry.decision.nextStep)}
            </Text>
          </View>
        ) : null}

        {entry.status === 'captured' && !error ? (
          <View style={styles.primaryActionCard}>
            <Text style={styles.primaryActionTitle}>Analyzing capture</Text>
            <Text style={styles.primaryActionSubtitle}>Alibi is already turning this recording into themes, ideas, and next-step signals.</Text>
          </View>
        ) : null}

        {entry.status === 'processing' ? (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Digest in progress</Text>
            <Text style={styles.infoBody}>Alibi is shaping the raw capture into themes, ideas, and reusable signals.</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Digest unavailable right now</Text>
            <Text style={styles.error}>{error}</Text>
            <View style={styles.errorActionRow}>
              <Button label="Try again" variant="secondary" onPress={() => void handleExtract()} />
            </View>
          </View>
        ) : null}

        {entry.status === 'extracted' ? (
          <>
            <Section title="Top Ideas">
              {(entry.ideas ?? []).length ? (
                (entry.ideas ?? []).slice(0, 5).map((i: { title: string; detail?: string }, idx: number) => (
                  <View key={idx} style={styles.ideaCard}>
                    <Text style={styles.ideaTitle}>{i.title}</Text>
                    {i.detail ? <Text style={styles.ideaDetail}>{i.detail}</Text> : null}
                  </View>
                ))
              ) : (
                <View style={styles.emptySectionCard}>
                  <Text style={styles.emptySectionTitle}>No ideas pulled out yet.</Text>
                  <Text style={styles.emptySectionBody}>The extraction finished, but this entry did not produce idea cards worth showing.</Text>
                </View>
              )}
            </Section>

            <Section title="Themes">
              {(entry.themes ?? []).length ? (
                <View style={styles.themeRow}>
                  {(entry.themes ?? []).map((t: string) => (
                    <Text key={t} style={styles.themeChip}>
                      {t}
                    </Text>
                  ))}
                </View>
              ) : (
                <View style={styles.emptySectionCard}>
                  <Text style={styles.emptySectionTitle}>No themes yet.</Text>
                  <Text style={styles.emptySectionBody}>Try extracting again later when the API is available or after refining the raw note.</Text>
                </View>
              )}
            </Section>

            <Section title="Highlights">
              {(entry.highlights ?? []).slice(0, 10).map((h: string, idx: number) => (
                <Text key={idx} style={styles.bullet}>
                  • {h}
                </Text>
              ))}
            </Section>
          </>
        ) : null}

        {entry.transcript ? (
          <Section title={entry.status === 'extracted' ? 'Transcript' : 'Raw transcript'}>
            {!isTranscriptExpanded ? (
              <Button label="View Full Transcript" variant="secondary" onPress={() => setIsTranscriptExpanded(true)} />
            ) : (
              <>
                <EntryAudioPlayer segments={entry.audioSegments || (entry.audioUri ? [{ uri: entry.audioUri, durationSec: entry.durationSec ?? 1, addedAt: entry.createdAt }] : [])} />
                <Text style={styles.transcript}>{entry.transcript}</Text>
                
                <View style={{ marginTop: tokens.space[16] }}>
                  <Button 
                    label="Append to Entry" 
                    variant="secondary" 
                    onPress={() => navigation.navigate('Recording', { appendToEntryId: entry.id, returnTo: 'entry' })} 
                  />
                </View>
              </>
            )}
          </Section>
        ) : null}
      </ScrollView>
    </ScreenLayout>
  );
}

function MetaPill({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.metaPill}>
      <Ionicons name={icon} size={tokens.icon.xxs} color={tokens.color.textMuted} />
      <Text style={styles.metaPillLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topMeta: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
  },
  scroll: {
    paddingBottom: tokens.space[24],
    gap: tokens.space[16],
  },
  headerCard: {
    padding: tokens.space[16],
    borderWidth: 1,
    borderColor: tokens.color.accentRing,
    backgroundColor: tokens.color.surface2,
    borderRadius: tokens.radius[12],
    gap: tokens.space[8],
  },
  headerEyebrow: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textFaint,
    fontWeight: tokens.font.weight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  entryTitle: {
    fontSize: tokens.font.size[18],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
  },
  entryMeta: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space[8],
    marginTop: tokens.space[4],
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[4],
    paddingHorizontal: tokens.space[8],
    paddingVertical: tokens.space[4],
    borderRadius: tokens.radius[100],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.surface,
  },
  metaPillLabel: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
  },
  primaryActionCard: {
    padding: tokens.space[16],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius[12],
    gap: tokens.space[8],
  },
  primaryActionTitle: {
    fontSize: tokens.font.size[16],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
  },
  primaryActionSubtitle: {
    fontSize: tokens.font.size[14],
    color: tokens.color.textMuted,
  },
  infoCard: {
    padding: tokens.space[12],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.surface2,
    borderRadius: tokens.radius[12],
    gap: tokens.space[4],
  },
  infoTitle: {
    fontSize: tokens.font.size[12],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
  },
  infoBody: {
    fontSize: tokens.font.size[12],
    lineHeight: 18,
    color: tokens.color.textMuted,
  },
  muted: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
  },
  error: {
    fontSize: tokens.font.size[12],
    color: tokens.color.text,
    lineHeight: 18,
  },
  errorCard: {
    padding: tokens.space[12],
    borderWidth: 1,
    borderColor: tokens.color.danger,
    backgroundColor: tokens.color.dangerSoft,
    borderRadius: tokens.radius[12],
    gap: tokens.space[4],
  },
  errorActionRow: {
    marginTop: tokens.space[8],
  },
  errorTitle: {
    fontSize: tokens.font.size[12],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
  },
  bullet: {
    fontSize: tokens.font.size[14],
    color: tokens.color.text,
    lineHeight: 20,
  },
  ideaCard: {
    padding: tokens.space[12],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius[12],
    gap: tokens.space[4],
  },
  ideaTitle: {
    fontSize: tokens.font.size[14],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
  },
  ideaDetail: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
  },
  emptySectionCard: {
    padding: tokens.space[12],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.surface2,
    borderRadius: tokens.radius[12],
    gap: tokens.space[4],
  },
  emptySectionTitle: {
    fontSize: tokens.font.size[12],
    color: tokens.color.text,
    fontWeight: tokens.font.weight.semibold,
  },
  emptySectionBody: {
    fontSize: tokens.font.size[12],
    lineHeight: 18,
    color: tokens.color.textMuted,
  },
  themeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space[8],
  },
  themeChip: {
    paddingVertical: tokens.space[8],
    paddingHorizontal: tokens.space[12],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius[12],
    fontSize: tokens.font.size[12],
    color: tokens.color.text,
  },
  transcript: {
    fontSize: tokens.font.size[14],
    color: tokens.color.text,
    lineHeight: 20,
  },
  stickyRow: {
    flexDirection: 'row',
    gap: tokens.space[12],
  },
  stickyItem: {
    flex: 1,
  },
});

