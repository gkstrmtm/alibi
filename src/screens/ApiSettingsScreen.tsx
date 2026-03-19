import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { Button } from '../components/Button';
import { ScreenLayout } from '../components/ScreenLayout';
import { Section } from '../components/Section';
import { getApiBaseUrl, normalizeBaseUrl } from '../config/env';
import { tokens } from '../theme/tokens';
import { useAppStore } from '../store/store';

type Props = NativeStackScreenProps<RootStackParamList, 'ApiSettings'>;

export function ApiSettingsScreen({ navigation }: Props) {
  const { state, dispatch } = useAppStore();

  const envBaseUrl = getApiBaseUrl();
  const savedOverride = state.settings.apiBaseUrlOverride ?? '';

  const [draftOverride, setDraftOverride] = useState(savedOverride);
  const [status, setStatus] = useState<string | null>(null);

  const effectiveBaseUrl = useMemo(() => {
    const override = normalizeBaseUrl(draftOverride);
    return override || envBaseUrl;
  }, [draftOverride, envBaseUrl]);

  async function testHealth() {
    setStatus('Checking…');
    const baseUrl = effectiveBaseUrl;
    if (!baseUrl) {
      setStatus('Missing base URL');
      return;
    }

    try {
      const r = await fetch(`${baseUrl}/api/health`);
      const data = (await r.json()) as any;
      if (!r.ok) {
        setStatus(`Health failed (${r.status})`);
        return;
      }
      setStatus(data?.ok ? 'OK' : 'Health response received');
    } catch (e: any) {
      setStatus(e?.message || 'Network error');
    }
  }

  return (
    <ScreenLayout
      title="API Connection"
      topRight={<Button label="Done" variant="secondary" onPress={() => navigation.goBack()} />}
      stickyBottom={
        <View style={styles.stickyRow}>
          <View style={styles.stickyItem}>
            <Button
              label="Use env default"
              variant="secondary"
              onPress={() => {
                setDraftOverride('');
                dispatch({ type: 'settings.resetApiBaseUrlOverride' });
                setStatus(null);
              }}
              disabled={!savedOverride}
            />
          </View>
          <View style={styles.stickyItem}>
            <Button
              label="Save"
              onPress={() => {
                dispatch({ type: 'settings.setApiBaseUrlOverride', payload: { value: draftOverride } });
                setStatus('Saved');
              }}
              disabled={draftOverride.trim() === savedOverride.trim()}
            />
          </View>
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Section title="Current">
          <View style={styles.card}>
            <Text style={styles.label}>Effective base URL</Text>
            <Text style={styles.value}>{effectiveBaseUrl || '(not set)'}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.label}>Env default</Text>
            <Text style={styles.value}>{envBaseUrl || '(not set)'}</Text>
          </View>
        </Section>

        <Section title="Override">
          <Text style={styles.helper}>Use this if your phone can’t reach your dev server or you want to point at a different Vercel deploy.</Text>
          <TextInput
            value={draftOverride}
            onChangeText={(t) => {
              setDraftOverride(t);
              setStatus(null);
            }}
            placeholder="https://your-app.vercel.app"
            placeholderTextColor={tokens.color.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            inputMode="url"
            style={styles.input}
          />
          <Button label="Test /api/health" variant="secondary" onPress={testHealth} disabled={!effectiveBaseUrl} />
          {status ? <Text style={styles.status}>{status}</Text> : null}
        </Section>
      </ScrollView>
    </ScreenLayout>
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
  card: {
    padding: tokens.space[12],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius[12],
    gap: tokens.space[8],
  },
  label: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
  },
  value: {
    fontSize: tokens.font.size[14],
    color: tokens.color.text,
    fontWeight: tokens.font.weight.semibold,
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
  status: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
  },
  stickyRow: {
    flexDirection: 'row',
    gap: tokens.space[12],
  },
  stickyItem: {
    flex: 1,
  },
});
