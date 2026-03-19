import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { extractEntry } from '../api/alibiApi';
import { Button } from '../components/Button';
import { ScreenLayout } from '../components/ScreenLayout';
import { Section } from '../components/Section';
import { tokens } from '../theme/tokens';
import { useAppStore } from '../store/store';
import { makeId } from '../utils/id';

type Props = NativeStackScreenProps<RootStackParamList, 'EntryDetail'>;

export function EntryDetailScreen({ route, navigation }: Props) {
  const { entryId } = route.params;
  const { state, dispatch } = useAppStore();
  const entry = state.entries[entryId];

  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false);

  useEffect(() => {
    setIsExtracting(false);
    setError(null);
  }, [entryId]);

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
      },
    });
    setIsExtracting(false);
  }

  const sticky = useMemo(() => {
    if (!entry) return null;
    return (
      <View style={styles.stickyRow}>
        <View style={styles.stickyItem}>
          <Button label="Add to Project" variant="secondary" onPress={() => navigation.navigate('SelectProject', { entryId: entry.id })} />
        </View>
        <View style={styles.stickyItem}>
          <Button
            label={entry.status === 'captured' ? 'Digest & Extract' : 'Quick Output (Standalone)'}
            loading={entry.status === 'captured' ? isExtracting : false}
            onPress={() => {
              if (entry.status === 'captured') {
                void handleExtract();
                return;
              }

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
      </View>
    );
  }, [canGenerate, dispatch, entry, handleExtract, isExtracting, navigation, state.drafts]);

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
          <Text style={styles.entryTitle}>{entry.title}</Text>
          <Text style={styles.entryMeta}>{new Date(entry.createdAt).toLocaleString()}</Text>
        </View>

        {entry.status === 'captured' ? (
          <View style={styles.primaryActionCard}>
            <Text style={styles.primaryActionTitle}>Ready to digest</Text>
            <Text style={styles.primaryActionSubtitle}>Turn the raw transcript into highlights, ideas, and themes when the API is available.</Text>
            <Button
              label="Digest & Extract"
              loading={isExtracting}
              onPress={() => void handleExtract()}
            />
          </View>
        ) : null}

        {entry.status === 'processing' ? <Text style={styles.muted}>Digesting the capture…</Text> : null}

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Digest unavailable right now</Text>
            <Text style={styles.error}>{error}</Text>
          </View>
        ) : null}

        {entry.status === 'extracted' ? (
          <>
            <Section title="Top Ideas">
              {(entry.ideas ?? []).slice(0, 5).map((i: { title: string; detail?: string }, idx: number) => (
                <View key={idx} style={styles.ideaCard}>
                  <Text style={styles.ideaTitle}>{i.title}</Text>
                  {i.detail ? <Text style={styles.ideaDetail}>{i.detail}</Text> : null}
                </View>
              ))}
            </Section>

            <Section title="Themes">
              <View style={styles.themeRow}>
                {(entry.themes ?? []).map((t: string) => (
                  <Text key={t} style={styles.themeChip}>
                    {t}
                  </Text>
                ))}
              </View>
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
              <Text style={styles.transcript}>{entry.transcript}</Text>
            )}
          </Section>
        ) : null}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  topMeta: {
    fontSize: tokens.font.size[12],
    color: '#6A6A6A',
  },
  scroll: {
    paddingBottom: tokens.space[24],
    gap: tokens.space[16],
  },
  headerCard: {
    padding: tokens.space[16],
    borderWidth: 1,
    borderColor: '#E6E6E6',
    borderRadius: tokens.radius[12],
    gap: tokens.space[8],
  },
  entryTitle: {
    fontSize: tokens.font.size[18],
    fontWeight: tokens.font.weight.semibold,
    color: '#111111',
  },
  entryMeta: {
    fontSize: tokens.font.size[12],
    color: '#6A6A6A',
  },
  primaryActionCard: {
    padding: tokens.space[16],
    borderWidth: 1,
    borderColor: '#E6E6E6',
    borderRadius: tokens.radius[12],
    gap: tokens.space[8],
  },
  primaryActionTitle: {
    fontSize: tokens.font.size[16],
    fontWeight: tokens.font.weight.semibold,
    color: '#111111',
  },
  primaryActionSubtitle: {
    fontSize: tokens.font.size[14],
    color: '#6A6A6A',
  },
  muted: {
    fontSize: tokens.font.size[12],
    color: '#6A6A6A',
  },
  error: {
    fontSize: tokens.font.size[12],
    color: '#8a4434',
    lineHeight: 18,
  },
  errorCard: {
    padding: tokens.space[12],
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 54, 0.22)',
    backgroundColor: 'rgba(255, 90, 54, 0.08)',
    borderRadius: tokens.radius[12],
    gap: tokens.space[4],
  },
  errorTitle: {
    fontSize: tokens.font.size[12],
    fontWeight: tokens.font.weight.semibold,
    color: '#7a2d1e',
  },
  bullet: {
    fontSize: tokens.font.size[14],
    color: '#111111',
    lineHeight: 20,
  },
  ideaCard: {
    padding: tokens.space[12],
    borderWidth: 1,
    borderColor: '#E6E6E6',
    borderRadius: tokens.radius[12],
    gap: tokens.space[4],
  },
  ideaTitle: {
    fontSize: tokens.font.size[14],
    fontWeight: tokens.font.weight.semibold,
    color: '#111111',
  },
  ideaDetail: {
    fontSize: tokens.font.size[12],
    color: '#6A6A6A',
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
    borderColor: '#E6E6E6',
    borderRadius: tokens.radius[12],
    fontSize: tokens.font.size[12],
    color: '#111111',
  },
  transcript: {
    fontSize: tokens.font.size[14],
    color: '#111111',
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
