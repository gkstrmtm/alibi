import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { Button } from '../components/Button';
import { ListRow } from '../components/ListRow';
import { ScreenLayout } from '../components/ScreenLayout';
import { buildStateWithProjectEntries } from '../store/projectMembership';
import { Toast } from '../components/Toast';
import { tokens } from '../theme/tokens';
import { useAppStore } from '../store/store';
import { supabasePushAll } from '../supabase/sync';

type Props = NativeStackScreenProps<RootStackParamList, 'SelectEntries'>;

export function SelectEntriesScreen({ route, navigation }: Props) {
  const { projectId } = route.params;
  const { state, dispatch } = useAppStore();
  const project = state.projects[projectId];

  const entries = useMemo(() => {
    return Object.values(state.entries)
      .filter(e => !project?.entryIds.includes(e.id))
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [state.entries]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  if (!project) {
    return (
      <ScreenLayout title="Add Entries">
        <Text style={styles.muted}>Project not found.</Text>
      </ScreenLayout>
    );
  }

  const selectedSet = new Set(selectedIds);

  return (
    <ScreenLayout
      title="Add Entries"
      stickyBottom={
        <View style={styles.stickyRow}>
          <Button
            label={isSaving ? 'Saving…' : 'Add entries'}
            loading={isSaving}
            disabled={isSaving || selectedIds.length === 0}
            onPress={async () => {
              const nextEntryIds = [...(project.entryIds || []), ...selectedIds];
              const nextState = buildStateWithProjectEntries(
                { entries: state.entries, projects: state.projects },
                { projectId: project.id, entryIds: nextEntryIds },
              );
              if (!nextState) return;

              if (state.auth.status === 'signedIn' && state.auth.userId) {
                setIsSaving(true);
                const pushed = await supabasePushAll({
                  entries: nextState.entries,
                  projects: nextState.projects,
                  drafts: state.drafts,
                });
                setIsSaving(false);
                if (!pushed.ok) {
                  setToastMessage(pushed.error);
                  return;
                }
              }

              dispatch({ type: 'project.setEntries', payload: { projectId: project.id, entryIds: nextEntryIds } });
              navigation.goBack();
            }}
          />
        </View>
      }
    >
      <Toast message={toastMessage} tone="danger" onHide={() => setToastMessage(null)} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.helper}>Select which entries belong in {project.name}.</Text>

        {entries.length ? (
          <View style={styles.list}>
            {entries.map((e) => {
              const selected = selectedSet.has(e.id);
              return (
                <ListRow
                  key={e.id}
                  title={e.title}
                  subtitle={new Date(e.createdAt).toLocaleString()}
                  right={selected ? 'Selected' : undefined}
                  onPress={() => {
                    setSelectedIds((curr) => {
                      const next = new Set(curr);
                      if (next.has(e.id)) next.delete(e.id);
                      else next.add(e.id);
                      return Array.from(next);
                    });
                  }}
                />
              );
            })}
          </View>
        ) : (
          <Text style={styles.muted}>No available entries yet.</Text>
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
  helper: {
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
});
