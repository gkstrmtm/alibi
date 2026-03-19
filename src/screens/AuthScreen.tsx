import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '../components/Button';
import { ScreenLayout } from '../components/ScreenLayout';
import { Section } from '../components/Section';
import type { RootStackParamList } from '../navigation/types';
import { getSupabaseClient } from '../supabase/client';
import { tokens } from '../theme/tokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Auth'>;
type AuthMode = 'signin' | 'signup';

function normalizeAuthMessage(message: string | undefined, mode: AuthMode) {
  const raw = (message ?? '').trim();
  if (!raw) return mode === 'signup' ? 'Sign up failed' : 'Sign in failed';

  const lower = raw.toLowerCase();
  if (lower.includes('email rate limit') || lower.includes('over_email_send_rate_limit') || lower.includes('rate limit')) {
    return 'Email confirmation is still enabled in Supabase. Turn it off in Supabase Auth settings if you want instant account creation.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Email confirmation is enabled in Supabase. Turn it off if you want sign-up to log in immediately.';
  }
  if (lower.includes('invalid login credentials')) {
    return 'That email/password combination is not active yet. If signup did not log you in, email confirmation is still enabled in Supabase.';
  }
  if (lower.includes('user already registered')) {
    return 'That email already has an account. Switch to sign in.';
  }

  return raw;
}

export function AuthScreen({ navigation }: Props) {
  const supabase = getSupabaseClient();

  const [mode, setMode] = useState<AuthMode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);

  const title = mode === 'signup' ? 'Create account' : 'Sign in';
  const helper =
    mode === 'signup'
      ? 'Create the account here. For instant login, email confirmation must be turned off in Supabase.'
      : 'Sign back into the same account so your synced work follows you.';

  async function submit() {
    if (submitting) return;
    if (!supabase) {
      setStatus('Supabase not available');
      return;
    }

    setSubmitting(true);
    setStatus(mode === 'signup' ? 'Creating account…' : 'Signing in…');

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const result =
        mode === 'signup'
          ? await supabase.auth.signUp({ email: normalizedEmail, password })
          : await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

      if (result.error) {
        setStatus(normalizeAuthMessage(result.error.message, mode));
        return;
      }

      const user = result.data.session?.user ?? result.data.user;

      if (mode === 'signup' && !result.data.session?.user) {
        setPendingConfirmationEmail(normalizedEmail);
        setMode('signin');
        setStatus('Signup is still waiting on email confirmation. Turn off email confirmation in Supabase Auth settings, then create the account again.');
        return;
      }

      setPendingConfirmationEmail(null);
      setStatus(mode === 'signup' ? `Account created for ${user?.email ?? normalizedEmail}` : 'Signed in');
      navigation.goBack();
    } catch (e: any) {
      setStatus(normalizeAuthMessage(e?.message, mode));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScreenLayout title="Account">
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>Account</Text>
          <Text style={styles.heroTitle}>{title}</Text>
          <Text style={styles.helper}>{helper}</Text>
        </View>

        <View style={styles.modeRow}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMode('signup');
              setStatus(null);
            }}
            style={[styles.modeChip, mode === 'signup' ? styles.modeChipActive : null]}
          >
            <Text style={[styles.modeChipText, mode === 'signup' ? styles.modeChipTextActive : null]}>Create account</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setMode('signin');
              setStatus(null);
            }}
            style={[styles.modeChip, mode === 'signin' ? styles.modeChipActive : null]}
          >
            <Text style={[styles.modeChipText, mode === 'signin' ? styles.modeChipTextActive : null]}>Sign in</Text>
          </Pressable>
        </View>

        <Section title="Credentials">
          <View style={styles.card}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setPendingConfirmationEmail(null);
                setStatus(null);
              }}
              placeholder="your email"
              placeholderTextColor={tokens.color.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={styles.input}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setStatus(null);
              }}
              placeholder="Password"
              placeholderTextColor={tokens.color.textFaint}
              secureTextEntry
              style={styles.input}
            />

            <View style={styles.actions}>
              <View style={styles.actionItem}>
                <Button
                  label={mode === 'signup' ? 'Create account' : 'Sign in'}
                  loading={submitting}
                  disabled={submitting || !email.trim() || !password}
                  onPress={() => {
                    void submit();
                  }}
                />
              </View>
              <View style={styles.actionItem}>
                <Button label="Cancel" variant="secondary" disabled={submitting} onPress={() => navigation.goBack()} />
              </View>
            </View>

            {pendingConfirmationEmail ? (
              <View style={styles.noticeCard}>
                <Text style={styles.noticeTitle}>Email confirmation is still on</Text>
                <Text style={styles.helper}>Account flow for {pendingConfirmationEmail} is being blocked by Supabase email-confirmation mode. If you want instant access, turn off email confirmation in Supabase and retry account creation.</Text>
              </View>
            ) : null}

            {status ? <Text style={styles.helper}>{status}</Text> : null}
          </View>
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
  heroCard: {
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
    fontSize: tokens.font.size[18],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
  },
  helper: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
    lineHeight: 18,
  },
  modeRow: {
    flexDirection: 'row',
    gap: tokens.space[12],
  },
  modeChip: {
    flex: 1,
    paddingVertical: tokens.space[8],
    paddingHorizontal: tokens.space[12],
    borderRadius: tokens.radius[12],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.surface,
    alignItems: 'center',
  },
  modeChipActive: {
    borderColor: tokens.color.accentRing,
    backgroundColor: tokens.color.accentSoft,
  },
  modeChipText: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
    fontWeight: tokens.font.weight.semibold,
  },
  modeChipTextActive: {
    color: tokens.color.text,
  },
  card: {
    padding: tokens.space[16],
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
  input: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface2,
    borderRadius: tokens.radius[12],
    padding: tokens.space[12],
    fontSize: tokens.font.size[14],
    color: tokens.color.text,
  },
  noticeCard: {
    marginTop: tokens.space[8],
    padding: tokens.space[12],
    borderWidth: 1,
    borderColor: tokens.color.accentRing,
    backgroundColor: tokens.color.surface2,
    borderRadius: tokens.radius[12],
    gap: tokens.space[8],
  },
  noticeTitle: {
    fontSize: tokens.font.size[14],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
  },
  actions: {
    flexDirection: 'row',
    gap: tokens.space[12],
    marginTop: tokens.space[8],
  },
  actionItem: {
    flex: 1,
  },
});
