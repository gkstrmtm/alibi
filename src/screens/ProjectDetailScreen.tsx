import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/store';
import { Button } from '../components/Button';
import { ScreenLayout } from '../components/ScreenLayout';
import { Section } from '../components/Section';
import { ListRow } from '../components/ListRow';
import { tokens } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectDetail'>;

export function ProjectDetailScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const { state } = useAppStore();
  const project = state.projects[projectId];

  if (!project) {
    return (
      <ScreenLayout title="Project">
        <Text style={styles.muted}>Project not found.</Text>
      </ScreenLayout>
    );
  }

  const entries = project.entryIds.map((id) => state.entries[id]).filter(Boolean);
  const drafts = project.draftIds.map((id) => state.drafts[id]).filter(Boolean);

  return (
    <ScreenLayout
      title="Project"
      topRight={<Text style={styles.topMeta}>{project.type === 'book' ? 'Book' : 'Project'}</Text>}
      stickyBottom={
        <View style={styles.stickyRow}>
          <View style={styles.stickyItem}>
            <Button label="Add Sources" variant="secondary" onPress={() => {}} />
          </View>
          <View style={styles.stickyItem}>
            <Button label="Open Studio" onPress={() => navigation.navigate('Studio', { projectId })} />
          </View>
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerCard}>
          <Text style={styles.projectName}>{project.name}</Text>
          <Text style={styles.projectMeta}>{`${entries.length} sources • ${drafts.length} drafts`}</Text>
        </View>

        <View style={styles.nextStepCard}>
          <Text style={styles.nextStepTitle}>Next step</Text>
          <Text style={styles.nextStepSubtitle}>Continue Studio Session</Text>
          <Button label="Open" onPress={() => navigation.navigate('Studio', { projectId })} />
        </View>

        {project.type === 'book' && project.book ? (
          <Section title="Book assets">
            <ListRow title="Brief" subtitle="Premise, audience, tone" onPress={() => navigation.navigate('Studio', { projectId })} />
            <ListRow title="Canon" subtitle={`${project.book.canon.length} cards`} onPress={() => navigation.navigate('Studio', { projectId })} />
            <ListRow title="Outline" subtitle={`${project.book.outline.length} items`} onPress={() => navigation.navigate('Studio', { projectId })} />
          </Section>
        ) : null}

        <Section title="Entries">
          {entries.length ? (
            entries.slice(0, 6).map((e) => (
              <ListRow
                key={e.id}
                title={e.title}
                subtitle={new Date(e.createdAt).toLocaleString()}
                onPress={() => navigation.navigate('EntryDetail', { entryId: e.id })}
              />
            ))
          ) : (
            <Text style={styles.muted}>No sources yet.</Text>
          )}
        </Section>

        <Section title="Drafts">
          {drafts.length ? (
            drafts.slice(0, 6).map((d) => (
              <ListRow
                key={d.id}
                title={d.title}
                subtitle={`v${d.version} • ${new Date(d.createdAt).toLocaleString()}`}
                onPress={() => navigation.navigate('Output', { draftId: d.id })}
              />
            ))
          ) : (
            <Text style={styles.muted}>No drafts yet.</Text>
          )}
        </Section>
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
  projectName: {
    fontSize: tokens.font.size[18],
    fontWeight: tokens.font.weight.semibold,
    color: '#111111',
  },
  projectMeta: {
    fontSize: tokens.font.size[12],
    color: '#6A6A6A',
  },
  nextStepCard: {
    padding: tokens.space[16],
    borderWidth: 1,
    borderColor: '#E6E6E6',
    borderRadius: tokens.radius[12],
    gap: tokens.space[8],
  },
  nextStepTitle: {
    fontSize: tokens.font.size[14],
    fontWeight: tokens.font.weight.semibold,
    color: '#111111',
  },
  nextStepSubtitle: {
    fontSize: tokens.font.size[14],
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
