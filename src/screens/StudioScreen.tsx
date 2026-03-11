import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { generateDraft } from '../api/alibiApi';
import { useAppStore } from '../store/store';
import type { StudioMode } from '../store/types';
import { Button } from '../components/Button';
import { ModeStrip } from '../components/ModeStrip';
import { ScreenLayout } from '../components/ScreenLayout';
import { Section } from '../components/Section';
import { tokens } from '../theme/tokens';
import { makeId } from '../utils/id';

type Props = NativeStackScreenProps<RootStackParamList, 'Studio'>;

const interviewPrompts = [
  'What does the protagonist want that they won’t admit?',
  'What rule does this world enforce that changes everything?',
  'What is the emotional promise of this book (in one sentence)?',
];

export function StudioScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const { state, dispatch } = useAppStore();
  const project = state.projects[projectId];
  const mode = (state.studio.modeByProjectId[projectId] ?? 'interview') as StudioMode;
  const [isGenerating, setIsGenerating] = useState(false);

  const sticky = useMemo(() => {
    const primaryLabel = mode === 'interview' ? 'Answer (placeholder)' : mode === 'draft' ? 'Generate' : 'Save';
    return (
      <View style={styles.stickyRow}>
        <View style={styles.stickyItem}>
          <Button label="Sources" variant="secondary" onPress={() => {}} />
        </View>
        <View style={styles.stickyItem}>
          <Button
            label={primaryLabel}
            disabled={mode === 'draft' ? isGenerating : false}
            onPress={() => {
              if (mode === 'draft') {
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
                  sources: entries,
                  canon,
                })
                  .then((result) => {
                    dispatch({
                      type: 'draft.create',
                      payload: {
                        draftId,
                        projectId,
                        entryIds: project?.entryIds ?? [],
                        format,
                        title,
                        content: result.ok ? result.content : '(Placeholder draft generated from selected canon + sources.)',
                      },
                    });
                    navigation.navigate('Output', { draftId });
                  })
                  .finally(() => setIsGenerating(false));
              }
              if (mode === 'build' && project?.type === 'book') {
                dispatch({
                  type: 'book.addCanonCard',
                  payload: { projectId, kind: 'theme', title: 'Theme (placeholder)', detail: 'A canon card created from a studio decision.' },
                });
              }
              if (mode === 'outline' && project?.type === 'book') {
                dispatch({ type: 'book.addOutlineItem', payload: { projectId, title: 'New outline item' } });
              }
            }}
          />
        </View>
      </View>
    );
  }, [dispatch, isGenerating, mode, navigation, project?.book?.canon, project?.entryIds, project?.name, project?.type, projectId, state.entries]);

  if (!project) {
    return (
      <ScreenLayout title="Studio">
        <Text style={styles.muted}>Project not found.</Text>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout title="Studio" topRight={<Text style={styles.topMeta}>{project.name}</Text>} stickyBottom={sticky}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ModeStrip value={mode} onChange={(m) => dispatch({ type: 'studio.setMode', payload: { projectId, mode: m } })} />

        {mode === 'interview' ? (
          <Section title="Interview">
            <Text style={styles.muted}>These questions are designed to extract missing nuance.</Text>
            {interviewPrompts.map((q) => (
              <View key={q} style={styles.card}>
                <Text style={styles.cardTitle}>{q}</Text>
                <Text style={styles.cardMeta}>Answer by voice or type (V1 placeholder).</Text>
              </View>
            ))}
          </Section>
        ) : null}

        {mode === 'build' ? (
          <Section title="Build">
            <Text style={styles.muted}>Project Brief + Canon live here (structured, user-approved).</Text>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Canon Cards</Text>
              <Text style={styles.cardMeta}>{project.book?.canon.length ?? 0} cards</Text>
            </View>
          </Section>
        ) : null}

        {mode === 'outline' ? (
          <Section title="Outline">
            <Text style={styles.muted}>Keep it list-first. No complex graph UI in V1.</Text>
            {(project.book?.outline ?? []).map((o) => (
              <View key={o.id} style={styles.card}>
                <Text style={styles.cardTitle}>{o.title}</Text>
                {o.note ? <Text style={styles.cardMeta}>{o.note}</Text> : null}
              </View>
            ))}
          </Section>
        ) : null}

        {mode === 'draft' ? (
          <Section title="Draft">
            <Text style={styles.muted}>Generate using selected sources + selected canon (not everything).</Text>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Draft settings</Text>
              <Text style={styles.cardMeta}>Format / Tone / Distance (sheet in V1)</Text>
            </View>
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
    maxWidth: 180,
  },
  scroll: {
    paddingBottom: tokens.space[24],
    gap: tokens.space[16],
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
  stickyRow: {
    flexDirection: 'row',
    gap: tokens.space[12],
  },
  stickyItem: {
    flex: 1,
  },
});
