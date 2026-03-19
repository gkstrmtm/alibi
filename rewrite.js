const fs = require('fs');

const tsxContent = `import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/store';
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

function ContextFAB({ 
  isRecording, 
  onToggleRecording, 
  onAmend 
}: { 
  isRecording: boolean, 
  onToggleRecording: () => void, 
  onAmend: (text: string) => void 
}) {
  if (!isRecording) {
    return (
      <View style={styles.fabContainer}>
        <Pressable onPress={onToggleRecording} style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}>
          <ScribbleMic size={64} iconSize={26} aggressive />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.dock}>
      <InlineRecorder onAmend={(text) => {
        onAmend(text);
        onToggleRecording();
      }} />
    </View>
  );
}

export function OutputScreen({ route, navigation }: Props) {
  const { draftId } = route.params;
  const { state, dispatch } = useAppStore();
  const draft = state.drafts[draftId];

  const [isEditing, setIsEditing] = useState(false);
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
              onBlur={() => {
                 setIsEditing(false);
                 handleSave();
              }}
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

        <ContextFAB 
          isRecording={isRecording}
          onToggleRecording={() => setIsRecording(!isRecording)}
          onAmend={(text) => {
             const newContent = isEditing
                 ? editedContent + '\n\n' + text
                 : (draft.content || '') + '\n\n' + text;
             if (isEditing) {
                 setEditedContent(newContent);
             } else {
                 dispatch({
                     type: 'draft.update',
                     payload: { draftId, content: newContent }
                 });
             }
          }}
        />
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
    padding: tokens.space[16],
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.border,
    borderRadius: tokens.radius[8],
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
`;

fs.writeFileSync('src/screens/OutputScreen.tsx', tsxContent);
console.log('Successfully updated src/screens/OutputScreen.tsx');
