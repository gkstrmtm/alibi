import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { ListRow } from '../components/ListRow';
import { Button } from '../components/Button';
import { ScreenLayout } from '../components/ScreenLayout';
import { Toast } from '../components/Toast';
import { buildStateWithAddedProjectEntry } from '../store/projectMembership';
import { tokens } from '../theme/tokens';
import { useAppStore } from '../store/store';
import { supabasePushAll } from '../supabase/sync';

type Props = NativeStackScreenProps<RootStackParamList, 'SelectProject'>;

export function SelectProjectScreen({ route, navigation }: Props) {
  const { entryId } = route.params;
  const onlyBook = Boolean(route.params.onlyBook);
  const { state, dispatch } = useAppStore();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isSavingProjectId, setIsSavingProjectId] = useState<string | null>(null);

  const entry = state.entries[entryId];
  const projects = Object.values(state.projects)
    .filter((p) => (onlyBook ? p.type === 'book' : true))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const currentProject = entry?.projectId ? state.projects[entry.projectId] : undefined;

  return (
    <ScreenLayout
      title={onlyBook ? 'Select Book Project' : 'Select Project'}
      
    >
      <Toast message={toastMessage} tone="default" onHide={() => setToastMessage(null)} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {entry ? (
          <View style={styles.helperBlock}>
            <Text style={styles.helper}>Entry: {entry.title}</Text>
            <Text style={styles.helperSecondary}>{currentProject ? `Currently in ${currentProject.name}` : 'Not in a project yet'}</Text>
            <Text style={styles.helperSecondary}>Tap a project to move this entry there.</Text>
          </View>
        ) : (
          <Text style={styles.muted}>Entry not found.</Text>
        )}

        {projects.length ? (
          <View style={styles.list}>
            {projects.map((p) => (
              <ListRow
                key={p.id}
                title={p.name}
                subtitle={`${p.type === 'book' ? 'Book' : 'Project'} • ${p.entryIds.length} entries • ${p.draftIds.length} drafts`}
                right={isSavingProjectId === p.id ? 'Saving…' : entry?.projectId === p.id ? 'Current' : undefined}
                onPress={async () => {
                  if (entry) {
                    if (isSavingProjectId) return;

                    const nextState = buildStateWithAddedProjectEntry(
                      { entries: state.entries, projects: state.projects },
                      { projectId: p.id, entryId: entry.id },
                    );
                    if (!nextState) {
                      setToastMessage('Could not prepare that project move.');
                      return;
                    }

                    if (state.auth.status === 'signedIn' && state.auth.userId) {
                      setIsSavingProjectId(p.id);
                      const pushed = await supabasePushAll({
                        entries: nextState.entries,
                        projects: nextState.projects,
                        drafts: state.drafts,
                      });
                      setIsSavingProjectId(null);
                      if (!pushed.ok) {
                        setToastMessage(pushed.error);
                        return;
                      }
                    }

                    dispatch({ type: 'project.addEntry', payload: { projectId: p.id, entryId: entry.id } });
                    navigation.replace('ProjectDetail', {
                      projectId: p.id,
                      toastMessage: entry.projectId === p.id ? `${entry.title} is already in ${p.name}.` : `${entry.title} added to ${p.name}.`,
                    });
                  }
                }}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyBlock}>
            <Text style={styles.muted}>{onlyBook ? 'No book projects yet.' : 'No projects yet.'}</Text>
            {entry ? (
                <Button
                  label={onlyBook ? 'Create Book Project' : 'Create Project'}
                  variant="secondary"
                  onPress={() => navigation.navigate('NewProject', { attachEntryId: entry.id, initialType: onlyBook ? 'book' : 'standard', afterCreate: onlyBook ? 'entry' : 'project' })}
                />
            ) : null}
          </View>
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
  helperBlock: {
    gap: tokens.space[8],
  },
  emptyBlock: {
    gap: tokens.space[12],
  },
  helper: {
    fontSize: tokens.font.size[12],
    color: tokens.color.text,
    fontWeight: tokens.font.weight.semibold,
  },
  helperSecondary: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
  },
  muted: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
  },
  stickyRow: {
    flexDirection: 'row',
  },
  stickyItem: {
    flex: 1,
  },
});
