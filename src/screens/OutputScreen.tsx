import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/store';
import { Button } from '../components/Button';
import { ScreenLayout } from '../components/ScreenLayout';
import { Section } from '../components/Section';
import { tokens } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Output'>;

export function OutputScreen({ route }: Props) {
  const { draftId } = route.params;
  const { state, dispatch } = useAppStore();
  const draft = state.drafts[draftId];

  if (!draft) {
    return (
      <ScreenLayout title="Output">
        <Text style={styles.muted}>Draft not found.</Text>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout
      title="Output"
      topRight={<Text style={styles.topMeta}>{`v${draft.version}`}</Text>}
      stickyBottom={
        <View style={styles.stickyRow}>
          <View style={styles.stickyItem}>
            <Button label="Regenerate" variant="secondary" onPress={() => dispatch({ type: 'draft.regenerate', payload: { draftId: draft.id } })} />
          </View>
          <View style={styles.stickyItem}>
            <Button label="Export" onPress={() => {}} />
          </View>
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerCard}>
          <Text style={styles.title}>{draft.title}</Text>
          <Text style={styles.meta}>{`${draft.format} • ${draft.tone} • ${draft.distance}`}</Text>
          <Text style={styles.meta}>Sources used: {draft.entryIds.length}</Text>
        </View>

        <Section title="Draft">
          <Text style={styles.content}>{draft.content}</Text>
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
  title: {
    fontSize: tokens.font.size[18],
    fontWeight: tokens.font.weight.semibold,
    color: '#111111',
  },
  meta: {
    fontSize: tokens.font.size[12],
    color: '#6A6A6A',
  },
  content: {
    fontSize: tokens.font.size[14],
    color: '#111111',
    lineHeight: 20,
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
