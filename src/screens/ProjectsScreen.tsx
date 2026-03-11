import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/store';
import { ListRow } from '../components/ListRow';
import { ScreenLayout } from '../components/ScreenLayout';
import { tokens } from '../theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ProjectsScreen() {
  const navigation = useNavigation<Nav>();
  const { state } = useAppStore();
  const projects = Object.values(state.projects).sort((a, b) => Number(b.pinned) - Number(a.pinned));

  return (
    <ScreenLayout title="Projects" topRight={<Text style={styles.topAction}>New</Text>}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {projects.length ? (
          <View style={styles.list}>
            {projects.map((p) => (
              <ListRow
                key={p.id}
                title={p.name}
                subtitle={`${p.type === 'book' ? 'Book' : 'Project'} • ${p.entryIds.length} sources • ${p.draftIds.length} drafts`}
                right={p.pinned ? 'Pinned' : undefined}
                onPress={() => navigation.navigate('ProjectDetail', { projectId: p.id })}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.muted}>No projects yet.</Text>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: tokens.space[24],
    gap: tokens.space[16],
  },
  list: {
    gap: tokens.space[12],
  },
  muted: {
    fontSize: tokens.font.size[12],
    color: '#6A6A6A',
  },
  topAction: {
    fontSize: tokens.font.size[12],
    color: '#6A6A6A',
  },
});
