import React, { useState, useEffect } from 'react';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { View, ScrollView, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/store';
import { reviseDraft } from '../api/alibiApi';
import { tokens } from '../theme/tokens';
import { ScreenLayout } from '../components/ScreenLayout';
import { InlineRecorder } from '../components/InlineRecorder';
import Markdown from 'react-native-markdown-display';
import { ScribbleMic } from '../components/ScribbleMic';

type Props = NativeStackScreenProps<RootStackParamList, 'Output'>;

const DARK_THEME = StyleSheet.create({
  body: { color: tokens.color.text, fontSize: 18, lineHeight: 28 },
  heading1: { color: tokens.color.text, fontSize: 24, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  heading2: { color: tokens.color.text, fontSize: 20, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  heading3: { color: tokens.color.text, fontSize: 18, fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  link: { color: tokens.color.brand },
  code_inline: { backgroundColor: tokens.color.surface, color: tokens.color.text, padding: 4, borderRadius: 4 },
  code_block: { backgroundColor: tokens.color.surface, color: tokens.color.text, padding: 16, borderRadius: 8, marginTop: 8, marginBottom: 8 },
  fence: { backgroundColor: tokens.color.surface, color: tokens.color.text, padding: 16, borderRadius: 8, marginTop: 8, marginBottom: 8 },
  blockquote: { backgroundColor: tokens.color.surface, color: tokens.color.textMuted, padding: 16, borderLeftWidth: 4, borderLeftColor: tokens.color.borderSubtle },
  hr: { backgroundColor: tokens.color.borderSubtle, height: 1, marginTop: 16, marginBottom: 16 },
  list_item: { color: tokens.color.text, fontSize: 18, lineHeight: 28 },
});


export function OutputScreen({ route, navigation }: Props) {
  const { draftId } = route.params;
  const { state, dispatch } = useAppStore();
  const draft = state.drafts[draftId];

  const [isEditing, setIsEditing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  
  const handlePlayback = () => {
    if (isPlaying) {
      Speech.stop();
      setIsPlaying(false);
    } else {
      Speech.speak(draft?.content || '', { onDone: () => setIsPlaying(false), onStopped: () => setIsPlaying(false) });
      setIsPlaying(true);
    }
  };
  const [editedContent, setEditedContent] = useState(draft?.content || '');
  const [isRecording, setIsRecording] = useState(false);

  useEffect(() => {
    if (draft && !isEditing) {
      setEditedContent(draft.content || '');
    }
  }, [draft?.content, isEditing]);

  if (!draft) {
    return (
      <ScreenLayout title="Output">
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Draft not found</Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.button}>
            <Text style={styles.buttonText}>Go Back</Text>
          </Pressable>
        </View>
      </ScreenLayout>
    );
  }

  const handleSave = () => {
    dispatch({
      type: 'draft.update',
      payload: { draftId, content: editedContent },
    });
    setIsEditing(false);
  };

  const activeProject = draft.projectId ? state.projects[draft.projectId] : undefined;
  const projectTitle = activeProject ? activeProject.name : 'Draft';

  return (
    <ScreenLayout title={projectTitle}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}
      >
        <ScrollView style={styles.contentContainer} contentContainerStyle={styles.contentScroll}>
          <View style={styles.headerRow}>
            <Text style={styles.draftTitle}>{draft.title || 'Untitled Draft'}</Text>
            <Pressable
              style={styles.actionChip}
              onPress={() => isEditing ? handleSave() : setIsEditing(true)}
            >
              <Text style={styles.actionChipText}>{isEditing ? 'Save' : 'Edit'}</Text>
            </Pressable>
          </View>

          {isEditing ? (
            <TextInput
              style={styles.textInput}
              multiline
              value={editedContent}
              onChangeText={setEditedContent}
              autoFocus
              onBlur={() => handleSave()}
            />
          ) : (
            <Pressable onPress={() => setIsEditing(true)}>
              <View pointerEvents="none">
                <Markdown style={DARK_THEME}>
                  {draft.content || ''}
                </Markdown>
              </View>
            </Pressable>
          )}
        </ScrollView>

                <View style={styles.assistantDockOuter}>
          {isRecording ? (
            <View style={styles.dock}>
              <InlineRecorder onAmend={async (text) => {
                setIsRecording(false);
                if (!text.trim()) return;
                setIsRevising(true);
                const project = state.projects[draft?.projectId || ''];
                const res = await reviseDraft({
                  projectName: project?.name || 'Project',
                  format: draft?.format || 'outline',
                  draftTitle: draft?.title || '',
                  currentDraft: draft?.content || '',
                  instruction: text,
                  sources: [],
                  canon: (project?.book?.canon || []).map((ctx: any) => ({ kind: ctx.kind, title: ctx.title, detail: ctx.detail }))
                }, { baseUrl: state.settings.apiBaseUrlOverride });
                
                setIsRevising(false);
                if (res.ok) {
                  setEditedContent(res.content);
                  dispatch({ type: 'draft.update', payload: { draftId, content: res.content } });
                }
              }} />
            </View>
          ) : (
            <View style={[styles.assistantDock, isRevising && {opacity: 0.5}]} pointerEvents={isRevising ? 'none' : 'auto'}>
               <Pressable onPress={handlePlayback} style={styles.assistantActionButton}>
                 <Ionicons name={isPlaying ? 'stop-circle' : 'volume-high'} size={24} color={tokens.color.text} />
               </Pressable>
               <Pressable onPress={() => setIsRecording(true)} style={styles.assistantNudgeBar}>
                 <Ionicons name="sparkles" size={16} color={tokens.color.brand} />
                 {isRevising ? <Text style={styles.assistantNudgeText}>Revising draft...</Text> : <Text style={styles.assistantNudgeText}>Nudge Draft...</Text>}
               </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    backgroundColor: tokens.color.bg,
  },
  contentScroll: {
    padding: tokens.space[20],
    paddingBottom: tokens.space[40] + 80,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.space[24],
  },
  draftTitle: {
    fontSize: tokens.font.size[24],
    fontWeight: tokens.font.weight.bold,
    color: tokens.color.text,
    flex: 1,
    marginRight: tokens.space[16],
  },
  actionChip: {
    paddingHorizontal: tokens.space[16],
    paddingVertical: tokens.space[8],
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    borderRadius: tokens.radius[16],
  },
  actionChipText: {
    fontSize: tokens.font.size[14],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.accent,
  },
  textInput: {
    fontSize: tokens.font.size[18],
    color: tokens.color.text,
    lineHeight: 28,
    minHeight: 400,
    textAlignVertical: 'top',
    padding: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  assistantDockOuter: {
    borderTopWidth: 1,
    borderTopColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.surface,
  },
  assistantDock: {
    flexDirection: 'row',
    padding: tokens.space[16],
    paddingBottom: Platform.OS === 'ios' ? 32 : tokens.space[16],
    alignItems: 'center',
    gap: tokens.space[12],
  },
  assistantActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: tokens.color.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  assistantNudgeBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.color.surface2,
    paddingHorizontal: tokens.space[16],
    height: 44,
    borderRadius: 22,
    gap: tokens.space[8],
  },
  assistantNudgeText: {
    color: tokens.color.textMuted,
    fontSize: tokens.font.size[14],
    fontWeight: tokens.font.weight.medium,
  },
  dock: {
    borderTopWidth: 1,
    borderTopColor: tokens.color.border,
    backgroundColor: tokens.color.surface,
    padding: tokens.space[16],
    paddingBottom: Platform.OS === 'ios' ? 32 : tokens.space[16],
  },
  fabContainer: {
    position: 'absolute',
    bottom: 32,
    right: 32,
    zIndex: 100,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  fabPressed: {
    opacity: 0.8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: tokens.color.textMuted,
    fontSize: tokens.font.size[16],
    marginBottom: tokens.space[16],
  },
  button: {
    paddingHorizontal: tokens.space[24],
    paddingVertical: tokens.space[12],
    backgroundColor: tokens.color.brand,
    borderRadius: tokens.radius[8],
  },
  buttonText: {
    color: tokens.color.surface,
    fontSize: tokens.font.size[16],
    fontWeight: tokens.font.weight.bold,
  }
});
