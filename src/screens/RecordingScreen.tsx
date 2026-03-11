import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { Button } from '../components/Button';
import { ScreenLayout } from '../components/ScreenLayout';
import { tokens } from '../theme/tokens';
import { useAppStore } from '../store/store';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function formatTime(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function RecordingScreen() {
  const navigation = useNavigation<Nav>();
  const { dispatch } = useAppStore();

  const [isRecording, setIsRecording] = useState(true);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!isRecording) return;
    const id = setInterval(() => setElapsedSec((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isRecording]);

  const status = useMemo(() => (isRecording ? 'Recording' : 'Paused'), [isRecording]);

  return (
    <ScreenLayout title="Recording" topRight={<Text style={styles.status}>{status}</Text>}>
      <View style={styles.container}>
        <View style={styles.wave}>
          <Text style={styles.waveText}>Waveform</Text>
        </View>

        <Text style={styles.time}>{formatTime(elapsedSec)}</Text>

        <View style={styles.controls}>
          <Button label={isRecording ? 'Pause' : 'Resume'} variant="secondary" onPress={() => setIsRecording((v) => !v)} />
          <Button
            label="Finish"
            onPress={() => {
              dispatch({ type: 'entry.createRecordingPlaceholder', payload: { durationSec: elapsedSec } });
              navigation.navigate('Tabs');
            }}
          />
        </View>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  status: {
    fontSize: tokens.font.size[12],
    color: '#6A6A6A',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space[16],
  },
  wave: {
    width: '100%',
    height: 140,
    borderWidth: 1,
    borderColor: '#E6E6E6',
    borderRadius: tokens.radius[12],
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveText: {
    color: '#6A6A6A',
    fontSize: tokens.font.size[14],
  },
  time: {
    fontSize: tokens.font.size[20],
    fontWeight: tokens.font.weight.semibold,
    color: '#111111',
  },
  controls: {
    width: '100%',
    flexDirection: 'row',
    gap: tokens.space[12],
  },
});
