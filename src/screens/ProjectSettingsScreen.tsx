import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState, useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/store';
import { Button } from '../components/Button';
import { ScreenLayout } from '../components/ScreenLayout';
import { tokens } from '../theme/tokens';
import { buildNarrativeProgress, describeNarrativeProgress, narrativeStepPreview } from '../utils/narrativeProgress';

type Props = NativeStackScreenProps<RootStackParamList, 'ProjectSettings'>;

export function ProjectSettingsScreen({ route, navigation }: Props) {
  const { projectId, focusSection } = route.params;
  const { state, dispatch } = useAppStore();
  const project = state.projects[projectId];
  const [activeSection, setActiveSection] = useState<'brief' | 'canon' | 'outline'>(focusSection ?? 'brief');

  const [briefDraft, setBriefDraft] = useState({ premise: '', audience: '', tone: '', constraints: '' });
  const [savedStatus, setSavedStatus] = useState<string | null>(null);
  const [cardTitle, setCardTitle] = useState('');
  const [cardDetail, setCardDetail] = useState('');
  const [cardKind, setCardKind] = useState<'character' | 'world' | 'theme' | 'claim' | 'timeline'>('claim');
  const [editingCanonId, setEditingCanonId] = useState<string | null>(null);
  const [selectedShadowId, setSelectedShadowId] = useState<string | null>(null);
  const [outlineTitle, setOutlineTitle] = useState('');
  const [outlineNote, setOutlineNote] = useState('');
  const [editingOutlineId, setEditingOutlineId] = useState<string | null>(null);

  const projectEntries = useMemo(
    () => (project?.entryIds ?? []).map((id) => state.entries[id]).filter(Boolean),
    [project?.entryIds, state.entries],
  );
  const narrativeProgress = useMemo(
    () => buildNarrativeProgress({ project, draftsById: state.drafts }),
    [project, state.drafts],
  );

  const shadowMemory = useMemo(() => {
    if (project?.type !== 'book') return [];
    const existingKeys = new Set((project.book?.canon ?? []).map((card) => `${card.title}`.toLowerCase().trim()));
    const next = projectEntries
      .filter((entry) => entry.status === 'extracted')
      .flatMap((entry) => {
        const ideaCards = (entry.ideas ?? []).map((idea, index) => ({
          id: `idea:${entry.id}:${index}`,
          kind: 'claim' as const,
          title: (idea.title ?? '').trim(),
          detail: (idea.detail ?? idea.title ?? '').trim(),
          source: entry.title,
        }));
        const highlightCards = (entry.highlights ?? []).map((highlight, index) => ({
          id: `highlight:${entry.id}:${index}`,
          kind: 'claim' as const,
          title: highlight.trim().slice(0, 72),
          detail: highlight.trim(),
          source: entry.title,
        }));
        const themeCards = (entry.themes ?? []).map((theme, index) => ({
          id: `theme:${entry.id}:${index}`,
          kind: 'theme' as const,
          title: theme.trim(),
          detail: `${theme.trim()} appears in ${entry.title}.`,
          source: entry.title,
        }));
        return [...ideaCards, ...highlightCards, ...themeCards];
      })
      .filter((item) => item.title && item.detail)
      .filter((item) => !existingKeys.has(item.title.toLowerCase().trim()));

    const deduped: typeof next = [];
    const seen = new Set<string>();
    for (const item of next) {
      const key = `${item.kind}:${item.title.toLowerCase().trim()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(item);
      if (deduped.length >= 8) break;
    }
    return deduped;
  }, [project, projectEntries]);

  useEffect(() => {
    setSavedStatus(null);
    setActiveSection(focusSection ?? 'brief');
    setEditingCanonId(null);
    setSelectedShadowId(null);
    setCardKind('claim');
    setCardTitle('');
    setCardDetail('');
    setOutlineTitle('');
    setOutlineNote('');
    setEditingOutlineId(null);
    const brief = project?.type === 'book' ? project.book?.brief : undefined;
    setBriefDraft({
      premise: typeof brief?.premise === 'string' ? brief.premise : '',
      audience: typeof brief?.audience === 'string' ? brief.audience : '',
      tone: typeof brief?.tone === 'string' ? brief.tone : '',
      constraints: typeof brief?.constraints === 'string' ? brief.constraints : '',
    });
  }, [focusSection, projectId, project?.book?.brief?.premise, project?.book?.brief?.audience, project?.book?.brief?.tone, project?.book?.brief?.constraints, project?.type]);

  useEffect(() => {
    if (!editingCanonId) return;
    setSelectedShadowId(null);
  }, [editingCanonId]);

  useEffect(() => {
    if (activeSection !== 'canon') return;
    if (editingCanonId || selectedShadowId) return;
    const first = shadowMemory[0];
    if (!first) return;
    setSelectedShadowId(first.id);
    setCardKind(first.kind);
    setCardTitle(first.title);
    setCardDetail(first.detail);
  }, [activeSection, editingCanonId, selectedShadowId, shadowMemory]);

  useEffect(() => {
    if (project?.type !== 'book') return;
    if (project.book?.outline?.length) return;
    dispatch({ type: 'book.materializeNarrativeOutline', payload: { projectId } });
  }, [dispatch, project?.book?.outline?.length, project?.type, projectId]);

  if (!project) {
    return (
      <ScreenLayout title="Project Settings">
        <Text style={styles.muted}>Project not found.</Text>
      </ScreenLayout>
    );
  }

  const handleSave = () => {
    if (project.type === 'book') {
      dispatch({ type: 'book.setBrief', payload: { projectId, brief: briefDraft } });
      setSavedStatus('Saved');
    }
  };

  const visibleShadowMemory = shadowMemory.slice(0, 4);
  const hiddenShadowCount = Math.max(0, shadowMemory.length - visibleShadowMemory.length);
  const canonEditorLabel = editingCanonId
    ? 'Editing locked memory'
    : selectedShadowId
      ? 'Reviewing source suggestion'
      : 'New locked memory';

  const focusMessage =
    activeSection === 'canon'
      ? 'Story memory is where reusable facts live so names, rules, and anchors stay consistent across the project.'
      : activeSection === 'outline'
        ? 'Chapter lanes keep the project oriented. Each lane names what this part is carrying so the drafting room stays grounded.'
        : 'Project settings is where the frame of the work gets locked in.';

  const addCanonCard = () => {
    if (project.type !== 'book') return;
    const title = cardTitle.trim();
    const detail = cardDetail.trim();
    if (!title || !detail) return;
    if (editingCanonId) {
      dispatch({ type: 'book.updateCanonCard', payload: { projectId, canonCardId: editingCanonId, kind: cardKind, title, detail } });
    } else {
      dispatch({ type: 'book.addCanonCard', payload: { projectId, kind: cardKind, title, detail } });
    }
    setEditingCanonId(null);
    setSelectedShadowId(null);
    setCardTitle('');
    setCardDetail('');
    setSavedStatus(editingCanonId ? 'Story memory updated' : 'Story memory saved');
  };

  const resetOutlineEditor = () => {
    setEditingOutlineId(null);
    setOutlineTitle('');
    setOutlineNote('');
  };

  const saveOutlineStep = () => {
    if (project.type !== 'book') return;
    const title = outlineTitle.trim();
    if (!title) return;
    if (editingOutlineId) {
      dispatch({ type: 'book.updateOutlineItem', payload: { projectId, outlineItemId: editingOutlineId, title, note: outlineNote.trim() } });
      setSavedStatus('Story step updated');
    } else {
      dispatch({ type: 'book.addOutlineItem', payload: { projectId, title, note: outlineNote.trim() || undefined } });
      setSavedStatus('Story step added');
    }
    resetOutlineEditor();
  };

  return (
    <ScreenLayout title="Project Settings">
      <ScrollView contentContainerStyle={styles.scroll} overScrollMode="never" bounces={false} showsVerticalScrollIndicator={false}>
        {project.type === 'book' ? (
          <>
            <View style={styles.calloutCard}>
              <Text style={styles.cardTitle}>Project frame</Text>
              <Text style={styles.cardMeta}>{focusMessage}</Text>
            </View>
            <View style={styles.sectionTabs}>
              {([
                { key: 'brief', label: 'Core context' },
                { key: 'canon', label: 'Story memory' },
                  { key: 'outline', label: 'Chapter lanes' },
              ] as const).map((item) => (
                <Pressable
                  key={item.key}
                  onPress={() => setActiveSection(item.key)}
                  style={[styles.sectionTab, activeSection === item.key ? styles.sectionTabActive : null]}
                >
                  <Text style={[styles.sectionTabText, activeSection === item.key ? styles.sectionTabTextActive : null]}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
            {activeSection === 'brief' ? <View style={styles.card}>
              <Text style={styles.cardTitle}>Core context</Text>
              <Text style={styles.cardMeta}>Keep only the framing information the project should reliably carry forward.</Text>
              <Text style={styles.fieldEyebrow}>Premise</Text>
              <TextInput value={briefDraft.premise} onChangeText={(t) => { setSavedStatus(null); setBriefDraft((b) => ({ ...b, premise: t })); }} placeholder="What is this project?" multiline style={styles.input} />
              <Text style={styles.fieldEyebrow}>Audience</Text>
              <TextInput value={briefDraft.audience} onChangeText={(t) => { setSavedStatus(null); setBriefDraft((b) => ({ ...b, audience: t })); }} placeholder="Who is this for?" multiline style={styles.input} />
              <Text style={styles.fieldEyebrow}>Tone</Text>
              <TextInput value={briefDraft.tone} onChangeText={(t) => { setSavedStatus(null); setBriefDraft((b) => ({ ...b, tone: t })); }} placeholder="How should it feel?" style={styles.miniInput} />
              <Text style={styles.fieldEyebrow}>Constraints</Text>
              <TextInput value={briefDraft.constraints} onChangeText={(t) => { setSavedStatus(null); setBriefDraft((b) => ({ ...b, constraints: t })); }} placeholder="Boundaries, rules, non-negotiables" multiline style={styles.input} />
              <View style={styles.editorActions}>
                <View style={styles.editorActionItem}>
                  <Button label="Save context" onPress={handleSave} />
                </View>
              </View>
              {savedStatus ? <Text style={styles.cardMeta}>{savedStatus}</Text> : null}
            </View> : null}

            {activeSection === 'canon' ? <View style={styles.card}>
              <Text style={styles.cardTitle}>Story memory</Text>
              <Text style={styles.cardMeta}>Facts worth keeping true should feel close at hand, not hidden behind setup.</Text>
              <View style={styles.legendCard}>
                <Text style={styles.legendTitle}>{canonEditorLabel}</Text>
                <Text style={styles.legendItem}>{editingCanonId ? 'You are changing an existing memory card.' : selectedShadowId ? 'This suggestion came from source. Adjust it if needed, then lock it.' : 'Write a fact directly when it needs to stay true before the next draft.'}</Text>
                <View style={styles.kindRow}>
                  {(['claim', 'character', 'world', 'theme', 'timeline'] as const).map((kind) => (
                    <Pressable key={kind} onPress={() => setCardKind(kind)} style={[styles.kindPill, cardKind === kind ? styles.kindPillActive : null]}>
                      <Text style={[styles.kindPillText, cardKind === kind ? styles.kindPillTextActive : null]}>{kind}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput value={cardTitle} onChangeText={(t) => { setSavedStatus(null); setCardTitle(t); }} placeholder="Card title" style={styles.miniInput} />
                <TextInput value={cardDetail} onChangeText={(t) => { setSavedStatus(null); setCardDetail(t); }} placeholder="What should stay true?" multiline style={styles.input} />
                <View style={styles.editorActions}>
                  <View style={styles.editorActionItem}>
                    <Button label={editingCanonId ? 'Update story memory' : 'Save story memory'} onPress={addCanonCard} disabled={!cardTitle.trim() || !cardDetail.trim()} />
                  </View>
                  {(editingCanonId || selectedShadowId || cardTitle || cardDetail) ? (
                    <View style={styles.editorActionItem}>
                      <Button label="Clear" variant="secondary" onPress={() => {
                        setEditingCanonId(null);
                        setSelectedShadowId(null);
                        setCardTitle('');
                        setCardDetail('');
                        setSavedStatus(null);
                      }} />
                    </View>
                  ) : null}
                </View>
              </View>
              <Text style={styles.fieldEyebrow}>Suggested from source</Text>
              <Text style={styles.cardMeta}>The first source suggestion loads automatically. Tap another anytime.</Text>
              {shadowMemory.length ? (
                <View style={styles.stack}>
                  {visibleShadowMemory.map((item) => (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        setSavedStatus(null);
                        setEditingCanonId(null);
                        setSelectedShadowId(item.id);
                        setCardKind(item.kind);
                        setCardTitle(item.title);
                        setCardDetail(item.detail);
                      }}
                      style={[styles.inlineCard, selectedShadowId === item.id ? styles.inlineCardSelected : null]}
                    >
                      <Text style={styles.inlineCardEyebrow}>{`SHADOW EXTRACT • ${item.source.toUpperCase()}`}</Text>
                      <Text style={styles.inlineCardTitle}>{item.title}</Text>
                      <Text style={styles.inlineCardBody}>{item.detail}</Text>
                    </Pressable>
                  ))}
                  {hiddenShadowCount ? <Text style={styles.cardMeta}>{`${hiddenShadowCount} more suggestions will appear after these.`}</Text> : null}
                </View>
              ) : (
                <View style={styles.inlineCard}>
                  <Text style={styles.inlineCardTitle}>No shadow memory yet</Text>
                  <Text style={styles.inlineCardBody}>Once project entries are extracted, suggested facts will appear here automatically for review.</Text>
                </View>
              )}
              {savedStatus ? <Text style={styles.cardMeta}>{savedStatus}</Text> : null}
              <Text style={styles.fieldEyebrow}>Locked memory</Text>
              {(project.book?.canon ?? []).length ? (
                <View style={styles.stack}>
                  {(project.book?.canon ?? []).map((card) => (
                    <Pressable
                      key={card.id}
                      onPress={() => {
                        setSavedStatus(null);
                        setEditingCanonId(card.id);
                        setSelectedShadowId(null);
                        setCardKind(card.kind);
                        setCardTitle(card.title);
                        setCardDetail(card.detail);
                      }}
                      style={[styles.inlineCard, editingCanonId === card.id ? styles.inlineCardSelected : null]}
                    >
                      <Text style={styles.inlineCardEyebrow}>{card.kind.toUpperCase()}</Text>
                      <Text style={styles.inlineCardTitle}>{card.title}</Text>
                      <Text style={styles.inlineCardBody}>{card.detail}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View style={styles.inlineCard}>
                  <Text style={styles.inlineCardTitle}>No story memory yet</Text>
                  <Text style={styles.inlineCardBody}>Use the shadow suggestions above, or write one directly if you need to lock a fact before the next draft.</Text>
                </View>
              )}
            </View> : null}

            {activeSection === 'outline' ? <View style={styles.card}>
              <Text style={styles.cardTitle}>Chapter lanes</Text>
              <Text style={styles.cardMeta}>This is the working path of the manuscript. The system keeps a forward shape under the hood, but this surface should read like clear chapter lanes, not abstract story mechanics.</Text>
              <View style={styles.legendCard}>
                <Text style={styles.legendTitle}>How this helps</Text>
                <Text style={styles.legendItem}>{describeNarrativeProgress({ project, draftsById: state.drafts })}</Text>
                <Text style={styles.legendItem}>Auto-shaped beats keep the manuscript moving forward even before every chapter lane is manually refined.</Text>
                <Text style={styles.legendItem}>When a new draft clearly belongs in one lane, it deepens that lane instead of drifting off as a disconnected chapter.</Text>
              </View>
              <Text style={styles.fieldEyebrow}>Lane editor</Text>
              <Text style={styles.cardMeta}>{editingOutlineId ? 'You are editing an existing chapter lane. Rename it or tighten what this part needs to carry.' : 'Add a lane only when you know what this part of the manuscript is responsible for.'}</Text>
              <TextInput value={outlineTitle} onChangeText={(t) => { setSavedStatus(null); setOutlineTitle(t); }} placeholder="Name this chapter lane" style={styles.miniInput} />
              <TextInput value={outlineNote} onChangeText={(t) => { setSavedStatus(null); setOutlineNote(t); }} placeholder="What should this lane carry forward?" multiline style={styles.input} />
              <View style={styles.editorActions}>
                <View style={styles.editorActionItem}>
                  <Button label={editingOutlineId ? 'Update lane' : 'Add lane'} onPress={saveOutlineStep} disabled={!outlineTitle.trim()} />
                </View>
                {(editingOutlineId || outlineTitle || outlineNote) ? (
                  <View style={styles.editorActionItem}>
                    <Button label="Clear" variant="secondary" onPress={() => {
                      setSavedStatus(null);
                      resetOutlineEditor();
                    }} />
                  </View>
                ) : null}
              </View>
              {savedStatus ? <Text style={styles.cardMeta}>{savedStatus}</Text> : null}
              <Text style={styles.fieldEyebrow}>Current chapter lanes</Text>
              {narrativeProgress.steps.length ? (
                <View style={styles.stack}>
                  {narrativeProgress.steps.map((item, index) => (
                    <Pressable
                      key={item.id}
                      onPress={() => {
                        setSavedStatus(null);
                        setEditingOutlineId(item.id);
                        setOutlineTitle(item.title);
                        setOutlineNote(item.note ?? '');
                      }}
                      style={[styles.inlineCard, editingOutlineId === item.id ? styles.inlineCardSelected : null]}
                    >
                      <Text style={styles.inlineCardEyebrow}>{`${item.label.toUpperCase()} • PART ${index + 1}`}</Text>
                      <Text style={styles.inlineCardTitle}>{item.title}</Text>
                      <Text style={styles.inlineCardBody}>{item.note?.trim() ? item.note : 'Describe the change, pressure, or turn this lane is responsible for.'}</Text>
                      <Text style={styles.cardMeta}>{`${item.status === 'expanded' ? `${item.draftCount} drafts deep here` : item.status === 'drafted' ? 'Already drafted once' : item.status === 'next' ? 'Next likely lane' : item.origin === 'auto' ? 'Auto-shaped lane' : 'Planned lane'} • ${narrativeStepPreview(item)}`}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <View style={styles.inlineCard}>
                  <Text style={styles.inlineCardTitle}>No chapter lanes yet</Text>
                  <Text style={styles.inlineCardBody}>Start with the opening pressure, the next complication, and the turn. The system will keep shaping the rest as the project grows.</Text>
                </View>
              )}
            </View> : null}
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Project Settings</Text>
            <Text style={styles.cardMeta}>There are currently no settings to configure for standard projects.</Text>
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
  card: {
    padding: tokens.space[16],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius[12],
    gap: tokens.space[8],
  },
  calloutCard: {
    padding: tokens.space[16],
    borderWidth: 1,
    borderColor: tokens.color.accentRing,
    backgroundColor: tokens.color.accentSoft,
    borderRadius: tokens.radius[12],
    gap: tokens.space[8],
  },
  sectionTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space[8],
  },
  sectionTab: {
    paddingHorizontal: tokens.space[12],
    paddingVertical: tokens.space[8],
    borderRadius: 999,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  sectionTabActive: {
    backgroundColor: tokens.color.accentSoft,
    borderColor: tokens.color.accentRing,
  },
  sectionTabText: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
    fontWeight: tokens.font.weight.semibold,
  },
  sectionTabTextActive: {
    color: tokens.color.text,
  },
  cardTitle: {
    fontSize: tokens.font.size[14],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
  },
  cardMeta: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
  },
  fieldEyebrow: {
    fontSize: tokens.font.size[10],
    color: tokens.color.textFaint,
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginTop: tokens.space[4],
  },
  legendCard: {
    padding: tokens.space[12],
    borderWidth: 1,
    borderColor: tokens.color.accentRing,
    backgroundColor: tokens.color.accentSoft,
    borderRadius: tokens.radius[12],
    gap: tokens.space[8],
  },
  legendTitle: {
    fontSize: tokens.font.size[12],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
  },
  legendItem: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
    lineHeight: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface2,
    borderRadius: tokens.radius[12],
    padding: tokens.space[12],
    fontSize: tokens.font.size[14],
    color: tokens.color.text,
    textAlignVertical: 'top',
    minHeight: 56,
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
  kindRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space[8],
  },
  kindPill: {
    paddingHorizontal: tokens.space[12],
    paddingVertical: tokens.space[8],
    borderRadius: 999,
    backgroundColor: tokens.color.surface2,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  kindPillActive: {
    backgroundColor: tokens.color.accentSoft,
    borderColor: tokens.color.accentRing,
  },
  kindPillText: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
    textTransform: 'capitalize',
  },
  kindPillTextActive: {
    color: tokens.color.accent,
    fontWeight: tokens.font.weight.semibold,
  },
  stack: {
    gap: tokens.space[8],
  },
  editorActions: {
    flexDirection: 'row',
    gap: tokens.space[12],
  },
  editorActionItem: {
    flex: 1,
  },
  inlineCard: {
    padding: tokens.space[12],
    borderRadius: tokens.radius[12],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.surface2,
    gap: tokens.space[4],
  },
  inlineCardSelected: {
    borderColor: tokens.color.accentRing,
    backgroundColor: tokens.color.accentSoft,
  },
  inlineCardEyebrow: {
    fontSize: tokens.font.size[10],
    color: tokens.color.textFaint,
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 1,
  },
  inlineCardTitle: {
    fontSize: tokens.font.size[14],
    color: tokens.color.text,
    fontWeight: tokens.font.weight.semibold,
  },
  inlineCardBody: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
    lineHeight: 18,
  },
  muted: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
  },
});