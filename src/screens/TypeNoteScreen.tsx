import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { Button } from '../components/Button';
import { ScreenLayout } from '../components/ScreenLayout';
import { Section } from '../components/Section';
import { tokens } from '../theme/tokens';
import { useAppStore } from '../store/store';
import { makeId } from '../utils/id';

type TargetFormat = 'essay' | 'commentary' | 'podcast-outline' | 'script' | 'thread' | 'book-chapter';

type Props = NativeStackScreenProps<RootStackParamList, 'TypeNote'>;

export function TypeNoteScreen({ navigation, route }: Props) {
  const { dispatch } = useAppStore();
  const projectId = route.params?.projectId;
  const draftId = route.params?.draftId;
  const returnTo = route.params?.returnTo ?? 'tabs';
  const intakeKey = route.params?.intakeKey;
  const promptLabel = route.params?.promptLabel?.trim();
  const [text, setText] = useState('');
  const [intent, setIntent] = useState('');
  const [targetFormat, setTargetFormat] = useState<TargetFormat | undefined>(undefined);

  const intentSuggestions = ['Telling a story', 'Discussing an idea', 'Processing something', 'Planning', 'Notes for later'];
  const formatSuggestions: Array<{ label: string; value: TargetFormat }> = [
    { label: 'Essay', value: 'essay' },
    { label: 'Podcast', value: 'podcast-outline' },
    { label: 'Book', value: 'book-chapter' },
  ];

  return (
    <ScreenLayout
      title="Type"
      stickyBottom={
        <View style={styles.stickyRow}>
          <Button label="Save" onPress={() => {
            const entryId = makeId('entry');
            const effectiveIntent = intakeKey ? `intake:${intakeKey}` : intent.trim() || undefined;
            dispatch({ type: 'entry.createText', payload: { entryId, title: promptLabel ? `Intake — ${promptLabel}` : undefined, text, intent: effectiveIntent, targetFormat, intakeKey } });
            if (projectId) {
              dispatch({ type: 'project.addEntry', payload: { projectId, entryId } });
              if (returnTo === 'studio') {
                navigation.replace('Studio', { projectId });
                return;
              }
              if (returnTo === 'project') {
                navigation.replace('ProjectDetail', { projectId });
                return;
              }
              if (returnTo === 'output' && draftId) {
                navigation.replace('Output', { draftId });
                return;
              }
            }
            if (returnTo === 'output' && draftId) {
              navigation.replace('Output', { draftId });
              return;
            }
            navigation.navigate('Tabs');
          }} disabled={!text.trim()} />
        </View>
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} overScrollMode="never" bounces={false} showsVerticalScrollIndicator={false}>
        {promptLabel ? (
          <Section title="Prompt">
            <Text style={styles.helper}>{promptLabel}</Text>
          </Section>
        ) : null}
        <Section title="What are you doing?">
          <Text style={styles.helper}>Keep it loose. You can change it later.</Text>
          <View style={styles.chipsRow}>
            {intentSuggestions.map((s) => (
              <Chip
                key={s}
                label={s}
                selected={intent.trim().toLowerCase() === s.toLowerCase()}
                onPress={() => setIntent((curr) => (curr.trim().toLowerCase() === s.toLowerCase() ? '' : s))}
              />
            ))}
          </View>
          <TextInput
            value={intent}
            onChangeText={setIntent}
            placeholder="e.g. I'm trying to explain a belief, or work through a moment"
            placeholderTextColor={tokens.color.textFaint}
            style={styles.miniInput}
          />
        </Section>

        <Section title="What are you making?">
          <Text style={styles.helper}>Optional. This just guides the output later.</Text>
          <View style={styles.chipsRow}>
            {formatSuggestions.map((f) => (
              <Chip
                key={f.value}
                label={f.label}
                selected={targetFormat === f.value}
                onPress={() => setTargetFormat((curr) => (curr === f.value ? undefined : f.value))}
              />
            ))}
            <Chip
              label="Not sure"
              selected={!targetFormat}
              onPress={() => setTargetFormat(undefined)}
            />
          </View>
        </Section>

        <Section title="Raw note">
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Write the raw thought. You can shape it later."
            placeholderTextColor={tokens.color.textFaint}
            multiline
            style={styles.input}
          />
        </Section>
      </ScrollView>
    </ScreenLayout>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected ? styles.chipSelected : null]}>
      <Text style={[styles.chipLabel, selected ? styles.chipLabelSelected : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: tokens.space[24],
    gap: tokens.space[16],
  },
  helper: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space[8],
  },
  chip: {
    paddingVertical: tokens.space[8],
    paddingHorizontal: tokens.space[12],
    borderRadius: tokens.radius[12],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.surface,
  },
  chipSelected: {
    borderColor: tokens.color.accentRing,
    backgroundColor: tokens.color.accentSoft,
  },
  chipLabel: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
    fontWeight: tokens.font.weight.semibold,
  },
  chipLabelSelected: {
    color: tokens.color.text,
  },
  miniInput: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface2,
    borderRadius: tokens.radius[12],
    padding: tokens.space[12],
    fontSize: tokens.font.size[14],
    color: tokens.color.text,
  },
  input: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface2,
    borderRadius: tokens.radius[12],
    padding: tokens.space[16],
    textAlignVertical: 'top',
    fontSize: tokens.font.size[16],
    color: tokens.color.text,
    minHeight: 220,
  },
  stickyRow: {
    flexDirection: 'row',
  },
});
