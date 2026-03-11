import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { Button } from '../components/Button';
import { ScreenLayout } from '../components/ScreenLayout';
import { Section } from '../components/Section';
import { tokens } from '../theme/tokens';
import { useAppStore } from '../store/store';

type TargetFormat = 'essay' | 'commentary' | 'podcast-outline' | 'script' | 'thread' | 'book-chapter';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function TypeNoteScreen() {
  const navigation = useNavigation<Nav>();
  const { dispatch } = useAppStore();
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
            dispatch({ type: 'entry.createText', payload: { text, intent: intent.trim() || undefined, targetFormat } });
            navigation.navigate('Tabs');
          }} disabled={!text.trim()} />
        </View>
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
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
    color: '#6A6A6A',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space[8],
  },
  chip: {
    paddingVertical: tokens.space[8],
    paddingHorizontal: tokens.space[12],
    borderRadius: tokens.radius[999],
    borderWidth: 1,
    borderColor: '#D0D0D0',
    backgroundColor: 'transparent',
  },
  chipSelected: {
    borderColor: '#111111',
    backgroundColor: '#111111',
  },
  chipLabel: {
    fontSize: tokens.font.size[12],
    color: '#111111',
    fontWeight: tokens.font.weight.semibold,
  },
  chipLabelSelected: {
    color: '#FFFFFF',
  },
  miniInput: {
    borderWidth: 1,
    borderColor: '#E6E6E6',
    borderRadius: tokens.radius[12],
    padding: tokens.space[12],
    fontSize: tokens.font.size[14],
    color: '#111111',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E6E6E6',
    borderRadius: tokens.radius[12],
    padding: tokens.space[16],
    textAlignVertical: 'top',
    fontSize: tokens.font.size[16],
    color: '#111111',
    minHeight: 220,
  },
  stickyRow: {
    flexDirection: 'row',
  },
});
