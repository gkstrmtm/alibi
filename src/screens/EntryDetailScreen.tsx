import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { Button } from '../components/Button';
import { ScreenLayout } from '../components/ScreenLayout';
import { Section } from '../components/Section';
import { tokens } from '../theme/tokens';
import { useAppStore } from '../store/store';
import { makeId } from '../utils/id';

type Props = NativeStackScreenProps<RootStackParamList, 'EntryDetail'>;

function makeMockExtraction(title: string) {
  const transcript = `${title}: (Placeholder transcript.)\n\nI’m trying to name the real idea underneath the mess.`;
  const highlights = [
    'Name the real idea underneath the mess.',
    'Turn fragments into something directional.',
  ];
  const themes = ['Direction', 'Voice', 'Long-form'];
  const ideas = [
    { title: 'Central tension', detail: 'What the project is trying to resolve.' },
    { title: 'Recurring question', detail: 'A question that anchors chapters.' },
    { title: 'Constraint', detail: 'A rule that prevents generic writing.' },
  ];
  return { transcript, highlights, themes, ideas };
}

export function EntryDetailScreen({ route, navigation }: Props) {
  const { entryId } = route.params;
  const { state, dispatch } = useAppStore();
  const entry = state.entries[entryId];

  const [ran, setRan] = useState(false);

  useEffect(() => {
    setRan(false);
  }, [entryId]);

  const canGenerate = entry?.status === 'extracted';
  const sticky = useMemo(() => {
    if (!entry) return null;
    return (
      <View style={styles.stickyRow}>
        <View style={styles.stickyItem}>
          <Button label="Add to Project" variant="secondary" onPress={() => {}} />
        </View>
        <View style={styles.stickyItem}>
          <Button
            label={entry.status === 'captured' ? 'Digest & Extract' : 'Generate Draft'}
            onPress={() => {
              if (entry.status === 'captured') {
                dispatch({ type: 'entry.setStatus', payload: { entryId: entry.id, status: 'processing' } });
                setRan(true);
                setTimeout(() => {
                  const mock = makeMockExtraction(entry.title);
                  dispatch({
                    type: 'entry.setExtraction',
                    payload: {
                      entryId: entry.id,
                      transcript: mock.transcript,
                      highlights: mock.highlights,
                      themes: mock.themes,
                      ideas: mock.ideas,
                    },
                  });
                }, 900);
                return;
              }

              if (canGenerate) {
                const draftId = makeId('draft');
                dispatch({
                  type: 'draft.create',
                  payload: {
                    draftId,
                    projectId: entry.projectId,
                    entryIds: [entry.id],
                    format: 'essay',
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
  }, [canGenerate, dispatch, entry, navigation, state.drafts]);

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
            <Text style={styles.primaryActionSubtitle}>Turn this into highlights, ideas, and themes.</Text>
            <Button
              label="Digest & Extract"
              onPress={() => {
                if (ran) return;
                dispatch({ type: 'entry.setStatus', payload: { entryId: entry.id, status: 'processing' } });
                setRan(true);
                setTimeout(() => {
                  const mock = makeMockExtraction(entry.title);
                  dispatch({
                    type: 'entry.setExtraction',
                    payload: {
                      entryId: entry.id,
                      transcript: mock.transcript,
                      highlights: mock.highlights,
                      themes: mock.themes,
                      ideas: mock.ideas,
                    },
                  });
                }, 900);
              }}
            />
          </View>
        ) : null}

        {entry.status === 'processing' ? <Text style={styles.muted}>Processing… (placeholder)</Text> : null}

        {entry.status === 'extracted' ? (
          <>
            <Section title="Highlights">
              {(entry.highlights ?? []).slice(0, 10).map((h: string, idx: number) => (
                <Text key={idx} style={styles.bullet}>
                  • {h}
                </Text>
              ))}
            </Section>

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

            <Section title="Transcript">
              <Text style={styles.transcript}>{entry.transcript ?? '(No transcript)'}</Text>
            </Section>
          </>
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
