import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { Button } from '../components/Button';
import { ScreenLayout } from '../components/ScreenLayout';
import { useAppStore } from '../store/store';
import { useImportMedia } from '../hooks/useImportMedia';
import { tokens } from '../theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function CreateScreen() {
  const navigation = useNavigation<Nav>();
  const { state } = useAppStore();
  const [message, setMessage] = React.useState<string | null>(null);
  const { importMedia, isImporting } = useImportMedia({ onMessage: setMessage });

  return (
    <ScreenLayout title="Create">
      <ScrollView contentContainerStyle={styles.scroll} overScrollMode="never" bounces={false} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>Intake</Text>
          <Text style={styles.heroTitle}>Raw capture first.</Text>
          <Text style={styles.heroSubtitle}>Record, type, or import depending on the moment. They all land in the same pipeline.</Text>
        </View>

        <View style={styles.stepperCard}>
          <View style={styles.stepperItem}>
            <View style={styles.stepperRailWrap}>
              <View style={[styles.stepperCircle, styles.stepperCircleActive]}>
                <Text style={styles.stepperCircleTextActive}>1</Text>
              </View>
              <View style={styles.stepperLine} />
            </View>
            <View style={styles.stepperContent}>
              <Text style={styles.stepperTitle}>Record</Text>
              <Text style={styles.stepperStatusActive}>Fastest</Text>
              <Text style={styles.stepperSubtitle}>Best for long thought, free recall, and deeper capture.</Text>
              <Button label="Record voice" onPress={() => {
                if (state.auth.status !== 'signedIn' || !state.auth.userId) {
                  navigation.navigate('Auth');
                  return;
                }
                navigation.navigate('Recording', { source: 'create' });
              }} />
            </View>
          </View>

          <View style={styles.stepperItem}>
            <View style={styles.stepperRailWrap}>
              <View style={styles.stepperCircle}>
                <Text style={styles.stepperCircleText}>2</Text>
              </View>
              <View style={styles.stepperLine} />
            </View>
            <View style={styles.stepperContent}>
              <Text style={styles.stepperTitle}>Type</Text>
              <Text style={styles.stepperStatus}>Quiet</Text>
              <Text style={styles.stepperSubtitle}>For short notes, edits, or direct intentional writing.</Text>
              <Button
                label="Type a note"
                variant="secondary"
                onPress={() => navigation.navigate('TypeNote', { source: 'create' })}
              />
            </View>
          </View>

          <View style={styles.stepperItemLast}>
            <View style={styles.stepperRailWrap}>
              <View style={styles.stepperCircleMuted}>
                <Text style={styles.stepperCircleTextMuted}>3</Text>
              </View>
            </View>
            <View style={styles.stepperContent}>
              <Text style={styles.stepperTitle}>Import</Text>
              <Text style={styles.stepperStatusMuted}>From device</Text>
              <Text style={styles.stepperSubtitle}>Bring in audio, video, files, or a transcript.</Text>
              <Button
                label={isImporting ? 'Importing…' : 'Import audio / transcript'}
                variant="secondary"
                onPress={importMedia}
                disabled={isImporting}
                loading={isImporting}
              />
              <Text style={styles.helper}>Imports land in the app immediately. Account-based sync can layer on later.</Text>
            </View>
          </View>
        </View>

        {message ? <Text style={styles.helper}>{message}</Text> : null}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: tokens.space[24],
    gap: tokens.space[16],
  },
  hero: {
    padding: tokens.space[16],
    borderWidth: 1,
    borderColor: tokens.color.accentRing,
    backgroundColor: tokens.color.surface2,
    borderRadius: tokens.radius[12],
    gap: tokens.space[8],
  },
  heroEyebrow: {
    fontSize: tokens.font.size[12],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.accent2,
  },
  heroTitle: {
    fontSize: tokens.font.size[20],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
    lineHeight: 26,
  },
  heroSubtitle: {
    fontSize: tokens.font.size[14],
    color: tokens.color.textMuted,
    lineHeight: 20,
  },
  stepperCard: {
    padding: tokens.space[16],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius[12],
    gap: tokens.space[16],
  },
  stepperItem: {
    flexDirection: 'row',
    gap: tokens.space[12],
  },
  stepperItemLast: {
    flexDirection: 'row',
    gap: tokens.space[12],
  },
  stepperRailWrap: {
    width: 40,
    alignItems: 'center',
  },
  stepperLine: {
    marginTop: tokens.space[8],
    width: 2,
    flex: 1,
    minHeight: 56,
    backgroundColor: tokens.color.border,
  },
  stepperCircle: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: tokens.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.surface2,
  },
  stepperCircleActive: {
    backgroundColor: tokens.color.accent,
    borderColor: tokens.color.accent,
  },
  stepperCircleMuted: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: tokens.color.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.surface2,
  },
  stepperCircleText: {
    fontSize: tokens.font.size[14],
    color: tokens.color.accent,
    fontWeight: tokens.font.weight.semibold,
  },
  stepperCircleTextActive: {
    fontSize: tokens.font.size[14],
    color: '#FFFFFF',
    fontWeight: tokens.font.weight.semibold,
  },
  stepperCircleTextMuted: {
    fontSize: tokens.font.size[14],
    color: tokens.color.textFaint,
    fontWeight: tokens.font.weight.semibold,
  },
  stepperContent: {
    flex: 1,
    gap: tokens.space[8],
  },
  stepperTitle: {
    fontSize: tokens.font.size[14],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
  },
  stepperStatus: {
    fontSize: tokens.font.size[12],
    color: tokens.color.accent,
    backgroundColor: tokens.color.accentSoft,
    alignSelf: 'flex-start',
    paddingHorizontal: tokens.space[8],
    paddingVertical: tokens.space[4],
    borderRadius: 999,
  },
  stepperStatusActive: {
    fontSize: tokens.font.size[12],
    color: '#FFFFFF',
    backgroundColor: tokens.color.accent,
    alignSelf: 'flex-start',
    paddingHorizontal: tokens.space[8],
    paddingVertical: tokens.space[4],
    borderRadius: 999,
  },
  stepperStatusMuted: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
    backgroundColor: tokens.color.surface2,
    alignSelf: 'flex-start',
    paddingHorizontal: tokens.space[8],
    paddingVertical: tokens.space[4],
    borderRadius: 999,
  },
  stepperSubtitle: {
    fontSize: tokens.font.size[14],
    color: tokens.color.textMuted,
    lineHeight: 20,
  },
  helper: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
  },
});
