import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../components/Button';
import { ScreenLayout } from '../components/ScreenLayout';
import { Section } from '../components/Section';
import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/store';
import type { ProjectType } from '../store/types';
import { tokens } from '../theme/tokens';
import { makeId } from '../utils/id';


type Props = NativeStackScreenProps<RootStackParamList, 'NewProject'>;

export function NewProjectScreen({ navigation, route }: Props) {
  const { dispatch } = useAppStore();
  const attachEntryId = route.params?.attachEntryId;
  const initialType = route.params?.initialType;
  const afterCreate = route.params?.afterCreate;
  const [name, setName] = useState('');
  const [projectType, setProjectType] = useState<ProjectType>(initialType ?? 'book');
  const [targetChapterCount, setTargetChapterCount] = useState<number>(4);

  const typeOptions = useMemo(() => {
    return [
      { label: 'Book / Structured', value: 'book' as const },
      { label: 'General / Loose', value: 'standard' as const },
    ];
  }, []);

  const scaleOptions = useMemo(() => {
    return [
      { label: 'Short', detail: '4 parts', value: 4 },
      { label: 'Medium', detail: '8 parts', value: 8 },
      { label: 'Long', detail: '12 parts', value: 12 },
    ];
  }, []);

  return (
    <ScreenLayout
      title="New Project"
      stickyBottom={
        <View style={styles.stickyRow}>
          <Button
            label="Create"
            disabled={!name.trim()}
            onPress={() => {
              const projectId = makeId('proj');
              dispatch({ type: 'project.create', payload: { projectId, name, projectType, targetChapterCount: projectType === 'book' ? targetChapterCount : undefined } });

              if (attachEntryId) {
                dispatch({ type: 'project.addEntry', payload: { projectId, entryId: attachEntryId } });
                if (afterCreate === 'entry') {
                  navigation.replace('EntryDetail', { entryId: attachEntryId });
                  return;
                }
              }

              navigation.replace('ProjectDetail', { projectId });
            }}
          />
        </View>
      }
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll} overScrollMode="never" bounces={false} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro}>Start a project, then record into it. Keep setup light.</Text>
        <Text style={styles.helper}>Use the project as a container for memory and output, not as a form to complete.</Text>

        <Section title="Name">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Founder stories"
            placeholderTextColor={tokens.color.textFaint}
            style={styles.input}
          />
        </Section>

        <Section title="Format">
          <Text style={styles.helper}>Everything starts as raw intake. Pick the workspace shape that fits what comes next.</Text>
          <View style={styles.chipsRow}>
            {typeOptions.map((t) => (
              <Chip
                key={t.value}
                label={t.label}
                selected={projectType === t.value}
                onPress={() => setProjectType(t.value)}
              />
            ))}
          </View>
          <Text style={styles.helper}>
            {projectType === 'book'
              ? 'Book includes mapped chapters and progressive narrative tracking.'
              : 'General stays lighter: just your captured material and loose drafts.'}
          </Text>
        </Section>

        {projectType === 'book' ? (
          <Section title="Project Scale">
            <Text style={styles.helper}>Roughly how long is the story or book you're planning? (You can change this later)</Text>
            <View style={styles.scaleRow}>
              {scaleOptions.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setTargetChapterCount(opt.value)}
                  style={[styles.scaleCard, targetChapterCount === opt.value ? styles.scaleCardSelected : null]}
                >
                  <Text style={[styles.scaleLabel, targetChapterCount === opt.value ? styles.scaleLabelSelected : null]}>{opt.label}</Text>
                  <Text style={[styles.scaleDetail, targetChapterCount === opt.value ? styles.scaleDetailSelected : null]}>{opt.detail}</Text>
                </Pressable>
              ))}
            </View>
          </Section>
        ) : null}

        <Text style={styles.helper}>
          {attachEntryId ? 'This will attach the entry after creation.' : 'Note: You can attach entries after creation.'}
        </Text>
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
  intro: {
    fontSize: tokens.font.size[16],
    color: tokens.color.text,
    fontWeight: tokens.font.weight.semibold,
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface2,
    borderRadius: tokens.radius[12],
    padding: tokens.space[12],
    fontSize: tokens.font.size[14],
    color: tokens.color.text,
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
  stickyRow: {
    flexDirection: 'row',
  },
  scaleRow: {
    flexDirection: 'row',
    gap: tokens.space[12],
    marginTop: tokens.space[8],
  },
  scaleCard: {
    flex: 1,
    padding: tokens.space[12],
    borderRadius: tokens.radius[12],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.surface,
    alignItems: 'center',
    gap: tokens.space[4],
  },
  scaleCardSelected: {
    borderColor: tokens.color.accentRing,
    backgroundColor: tokens.color.accentSoft,
  },
  scaleLabel: {
    fontSize: tokens.font.size[14],
    color: tokens.color.textMuted,
    fontWeight: tokens.font.weight.semibold,
  },
  scaleLabelSelected: {
    color: tokens.color.text,
  },
  scaleDetail: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textFaint,
  },
  scaleDetailSelected: {
    color: tokens.color.accent,
  },
});
