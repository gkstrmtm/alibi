import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { ScribbleMic } from './ScribbleMic';
import { Button } from './Button';
import { tokens } from '../theme/tokens';

export function InlineRecorder({ onAmend }: { onAmend: (text: string) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');

  useSpeechRecognitionEvent('result', (event) => {
    const t = event.results[0]?.transcript?.trim() || '';
    if (t) setTranscript(t);
  });

  const startRecording = async () => {
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) return;
      
      setTranscript('');
      setIsRecording(true);
      await Promise.resolve(ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
      }));
    } catch (e) {
      console.warn('Failed to start recording', e);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      await Promise.resolve(ExpoSpeechRecognitionModule.stop());
    } catch (e) {
      // ignore
    }
    setIsRecording(false);
  };

  const handleApply = async () => {
    await stopRecording();
    onAmend(transcript);
  };

  const handleCancel = async () => {
    await stopRecording();
  };

  if (!isRecording) {
    return (
      <View style={styles.fabContainer}>
        <Pressable onPress={startRecording} style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}>
          <ScribbleMic size={56} iconSize={24} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.panelContainer}>
      <Text style={styles.transcriptText}>
        {transcript || 'Listening...'}
      </Text>
      <View style={styles.buttonRow}>
        <Button label="Cancel" variant="secondary" onPress={handleCancel}  />
        <Button label="Apply" variant="primary" onPress={handleApply}  disabled={!transcript.trim()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    zIndex: 100,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: tokens.color.surface,
    borderColor: tokens.color.border,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  fabPressed: {
    opacity: 0.8,
  },
  panelContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    left: 24,
    zIndex: 100,
    backgroundColor: tokens.color.surface,
    borderRadius: 16,
    padding: 16,
    borderColor: tokens.color.border,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  transcriptText: {
    
    fontSize: 16,
    
    color: tokens.color.text,
    marginBottom: 16,
    minHeight: 48,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    minWidth: 80,
  },
});
