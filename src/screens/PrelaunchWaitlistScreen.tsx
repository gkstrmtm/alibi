import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScribbleMic } from '../components/ScribbleMic';
import type { WaitlistRole } from '../supabase/waitlist';
import { submitWaitlistLead } from '../supabase/waitlist';
import { tokens } from '../theme/tokens';

const ROLE_OPTIONS: Array<{ value: WaitlistRole; label: string }> = [
  { value: 'creator', label: 'Creator' },
  { value: 'writer', label: 'Writer' },
  { value: 'founder', label: 'Founder' },
  { value: 'thinker', label: 'Thinker' },
  { value: 'other', label: 'Other' },
];

const PRODUCT_MOMENTS = [
  {
    step: '01',
    title: 'Record a thought',
    body: 'Capture the unfinished idea before it disappears.',
    accent: 'voice → signal',
  },
  {
    step: '02',
    title: 'See what matters',
    body: 'Alibi extracts themes, pressure points, and usable directions.',
    accent: 'themes • ideas • lines',
  },
  {
    step: '03',
    title: 'Move into a project',
    body: 'Turn fragments into a space that remembers what the work is becoming.',
    accent: 'memory → structure',
  },
  {
    step: '04',
    title: 'Generate something real',
    body: 'Draft from your own raw material instead of starting from nowhere.',
    accent: 'notes → output',
  },
];

const DIFFERENT_POINTS = [
  {
    title: 'Not just voice memos',
    body: 'Raw capture is only the first layer. The point is what becomes usable after the capture.',
  },
  {
    title: 'Not just AI chat',
    body: 'Alibi is built around your source material, not endless prompting from a blank page.',
  },
  {
    title: 'A thinking studio',
    body: 'Ideas can stay fluid at first, then harden into projects, drafts, and durable memory.',
  },
  {
    title: 'Structured thought development',
    body: 'The system helps thoughts become connected, shaped, and worth returning to later.',
  },
];

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function SectionHeader({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{body}</Text>
    </View>
  );
}

function DemoCard({ step, title, body, accent, isSplit }: { step: string; title: string; body: string; accent: string; isSplit: boolean }) {
  return (
    <View style={[styles.demoCard, isSplit ? styles.demoCardSplit : null]}>
      <View style={styles.demoCardTop}>
        <Text style={styles.demoStep}>{step}</Text>
        <Text style={styles.demoAccent}>{accent}</Text>
      </View>
      <View style={styles.demoSurface}>
        <View style={styles.demoSurfaceHeader}>
          <View style={styles.demoDot} />
          <View style={[styles.demoLine, styles.demoLineShort]} />
        </View>
        <View style={styles.demoStack}>
          <View style={[styles.demoLine, styles.demoLineLarge]} />
          <View style={[styles.demoLine, styles.demoLineMedium]} />
          <View style={[styles.demoLine, styles.demoLineShort]} />
        </View>
        <View style={styles.demoTagRow}>
          <View style={styles.demoTag} />
          <View style={styles.demoTag} />
          <View style={[styles.demoTag, styles.demoTagMuted]} />
        </View>
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{body}</Text>
    </View>
  );
}

function DifferenceCard({ title, body, isSplit }: { title: string; body: string; isSplit: boolean }) {
  return (
    <View style={[styles.differenceCard, isSplit ? styles.differenceCardSplit : null]}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{body}</Text>
    </View>
  );
}

export function PrelaunchWaitlistScreen() {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView | null>(null);
  const glow = useRef(new Animated.Value(0.94)).current;
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<WaitlistRole>('creator');
  const [useCase, setUseCase] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'neutral' | 'success' | 'danger'>('neutral');
  const [betaSectionY, setBetaSectionY] = useState(0);

  const isTablet = width >= 720;
  const isDesktop = width >= 1040;
  const heroMicSize = isDesktop ? 196 : isTablet ? 172 : 148;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1.05,
          duration: 2600,
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0.94,
          duration: 2600,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [glow]);

  const statusStyle = useMemo(() => {
    if (statusTone === 'success') return styles.statusSuccess;
    if (statusTone === 'danger') return styles.statusDanger;
    return null;
  }, [statusTone]);

  const jumpToBeta = () => {
    scrollRef.current?.scrollTo({ y: Math.max(0, betaSectionY - 18), animated: true });
  };

  const handleSubmit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      setStatusTone('danger');
      setStatusMessage('Enter a valid email to join early access.');
      return;
    }

    setIsSubmitting(true);
    setStatusTone('neutral');
    setStatusMessage('Saving your spot…');

    const result = await submitWaitlistLead({
      email: normalizedEmail,
      role,
      useCase,
      betaOptIn: true,
      source: 'prelaunch-mobile-first',
    });

    if (result.ok) {
      setStatusTone('success');
      setStatusMessage(result.duplicate ? 'You are already on the list. We will reach out when your wave opens.' : 'You are in. Early access will roll out in waves.');
      if (!result.duplicate) setUseCase('');
      setEmail(normalizedEmail);
    } else {
      setStatusTone('danger');
      setStatusMessage(result.error);
    }

    setIsSubmitting(false);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.safeArea}>
      <View style={styles.root}>
        <LinearGradient colors={['#050608', '#07090d', '#090b11']} style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={styles.backgroundWrap}>
          <Animated.View style={[styles.backgroundGlow, { transform: [{ scale: glow }] }]} />
          <View style={styles.backgroundGrid} />
        </View>

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <View style={[styles.canvas, isDesktop ? styles.canvasDesktop : null]}>
            <View style={[styles.heroShell, isDesktop ? styles.heroShellDesktop : null]}>
              <View style={[styles.heroContent, isDesktop ? styles.heroContentDesktop : null]}>
                <View style={styles.brandRow}>
                  <View style={styles.brandPulse} />
                  <Text style={styles.brandLabel}>ALIBI</Text>
                  <View style={styles.brandDivider} />
                  <Text style={styles.brandMeta}>Private beta</Text>
                </View>

                <Text style={styles.heroTitle}>A private studio for turning voice thoughts into real work.</Text>
                <Text style={styles.heroBody}>
                  Record the rough thought. Let Alibi pull out the themes, shape the signal, and help it become a project worth building.
                </Text>

                <View style={styles.heroCtaCard}>
                  <Text style={styles.inputLabel}>Get early access</Text>
                  <TextInput
                    value={email}
                    onChangeText={(next) => {
                      setEmail(next);
                      if (statusTone !== 'success') setStatusMessage(null);
                    }}
                    placeholder="Email"
                    placeholderTextColor="rgba(231, 235, 240, 0.38)"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="email-address"
                    style={styles.emailInput}
                  />

                  <View style={[styles.heroButtonRow, isTablet ? styles.heroButtonRowWide : null]}>
                    <Pressable
                      accessibilityRole="button"
                      onPress={handleSubmit}
                      disabled={isSubmitting}
                      style={({ pressed }) => [styles.primaryButton, pressed ? styles.primaryButtonPressed : null, isSubmitting ? styles.buttonDisabled : null]}
                    >
                      <LinearGradient colors={['#ff7a59', '#ff5a36']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryButtonFill}>
                        <Text style={styles.primaryButtonText}>{isSubmitting ? 'Saving…' : 'Get early access'}</Text>
                      </LinearGradient>
                    </Pressable>

                    <Pressable accessibilityRole="button" onPress={jumpToBeta} style={({ pressed }) => [styles.secondaryButton, pressed ? styles.secondaryButtonPressed : null]}>
                      <Text style={styles.secondaryButtonText}>Join beta</Text>
                    </Pressable>
                  </View>

                  <View style={styles.trustRow}>
                    <TrustItem icon="shield-checkmark-outline" label="Private by default" />
                    <TrustItem icon="mail-open-outline" label="No spam" />
                    <TrustItem icon="sparkles-outline" label="Rolling access" />
                  </View>

                  {statusMessage ? (
                    <View style={[styles.statusCard, statusStyle]}>
                      <Text style={styles.statusText}>{statusMessage}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={[styles.heroVisualColumn, isDesktop ? styles.heroVisualColumnDesktop : null]}>
                <Animated.View style={[styles.heroOrb, { transform: [{ scale: glow }] }]} />
                <View style={styles.heroVisualCard}>
                  <Text style={styles.mockEyebrow}>Thinking, captured</Text>
                  <View style={styles.heroMicWrap}>
                    <ScribbleMic
                      size={heroMicSize}
                      iconSize={heroMicSize * 0.26}
                      aggressive
                      auraColor="#ff6b47"
                      orbitalColor="rgba(244, 246, 248, 0.92)"
                      coreBackgroundColor="#101319"
                      coreBorderColor="rgba(255, 122, 89, 0.45)"
                      coreShadowColor="#ff6b47"
                    />
                  </View>
                  <View style={styles.heroVisualMeta}>
                    <View style={styles.heroVisualLine} />
                    <View style={[styles.heroVisualLine, styles.heroVisualLineShort]} />
                    <View style={styles.signalPillRow}>
                      <SignalPill label="voice" />
                      <SignalPill label="themes" />
                      <SignalPill label="draft" muted />
                    </View>
                  </View>
                </View>
              </View>
            </View>

            <SectionHeader
              eyebrow="Product"
              title="From raw thought to something you can keep building."
              body="These are the moments the launch layer needs to make instantly clear."
            />

            <View style={[styles.demoGrid, isDesktop ? styles.demoGridDesktop : isTablet ? styles.demoGridTablet : null]}>
              {PRODUCT_MOMENTS.map((item) => (
                <DemoCard key={item.step} {...item} isSplit={isTablet} />
              ))}
            </View>

            <SectionHeader
              eyebrow="Why it feels different"
              title="A quieter, more useful kind of AI product."
              body="Built to help unfinished thoughts turn into structured work without losing their original shape."
            />

            <View style={[styles.differenceGrid, isTablet ? styles.differenceGridWide : null]}>
              {DIFFERENT_POINTS.map((item) => (
                <DifferenceCard key={item.title} {...item} isSplit={isTablet} />
              ))}
            </View>

            <View
              onLayout={(event) => setBetaSectionY(event.nativeEvent.layout.y)}
              style={[styles.betaShell, isDesktop ? styles.betaShellDesktop : null]}
            >
              <View style={[styles.betaCopyBlock, isDesktop ? styles.betaCopyBlockDesktop : null]}>
                <SectionHeader
                  eyebrow="Early access"
                  title="Tell us who you are and what you want Alibi for."
                  body="We are opening beta in small waves. Clear use cases help us choose the first groups well."
                />
                <View style={styles.betaNotesCard}>
                  <Text style={styles.cardTitle}>Who it is for</Text>
                  <Text style={styles.cardBody}>Creators, writers, founders, and people who think out loud before the work becomes formal.</Text>
                </View>
              </View>

              <View style={[styles.formCard, isDesktop ? styles.formCardDesktop : null]}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  value={email}
                  onChangeText={(next) => {
                    setEmail(next);
                    if (statusTone !== 'success') setStatusMessage(null);
                  }}
                  placeholder="you@example.com"
                  placeholderTextColor="rgba(231, 235, 240, 0.38)"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  style={styles.emailInput}
                />

                <Text style={styles.inputLabel}>Role</Text>
                <View style={styles.roleGrid}>
                  {ROLE_OPTIONS.map((option) => {
                    const selected = role === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        accessibilityRole="button"
                        onPress={() => setRole(option.value)}
                        style={({ pressed }) => [styles.roleChip, selected ? styles.roleChipSelected : null, pressed ? styles.roleChipPressed : null]}
                      >
                        <Text style={[styles.roleChipText, selected ? styles.roleChipTextSelected : null]}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.inputLabel}>What would you use this for?</Text>
                <TextInput
                  value={useCase}
                  onChangeText={setUseCase}
                  placeholder="Book notes, founder thinking, essay capture, project development…"
                  placeholderTextColor="rgba(231, 235, 240, 0.38)"
                  multiline
                  textAlignVertical="top"
                  style={styles.textArea}
                />

                <Pressable
                  accessibilityRole="button"
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  style={({ pressed }) => [styles.submitButton, pressed ? styles.primaryButtonPressed : null, isSubmitting ? styles.buttonDisabled : null]}
                >
                  <LinearGradient colors={['#ff7a59', '#ff5a36']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryButtonFill}>
                    <Text style={styles.primaryButtonText}>{isSubmitting ? 'Saving…' : 'Join the waitlist'}</Text>
                  </LinearGradient>
                </Pressable>

                <Text style={styles.formMeta}>No spam. No noisy launch funnel. Just product updates and beta access when your wave is ready.</Text>
                <Text style={styles.formMeta}>We are rolling access out gradually to keep the first experience tight.</Text>

                {statusMessage ? (
                  <View style={[styles.statusCard, statusStyle]}>
                    <Text style={styles.statusText}>{statusMessage}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.footerCard}>
              <Text style={styles.footerTitle}>Coming soon</Text>
              <Text style={styles.footerBody}>Alibi is being shaped in public, but access will open carefully. The product is real. The launch layer is here so the wait feels intentional.</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function TrustItem({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.trustItem}>
      <Ionicons name={icon} size={14} color="rgba(244, 246, 248, 0.72)" />
      <Text style={styles.trustText}>{label}</Text>
    </View>
  );
}

function SignalPill({ label, muted = false }: { label: string; muted?: boolean }) {
  return (
    <View style={[styles.signalPill, muted ? styles.signalPillMuted : null]}>
      <Text style={[styles.signalPillText, muted ? styles.signalPillTextMuted : null]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#050608',
  },
  root: {
    flex: 1,
    backgroundColor: '#050608',
  },
  backgroundWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  backgroundGlow: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 999,
    top: -120,
    right: -90,
    backgroundColor: 'rgba(255, 90, 54, 0.16)',
  },
  backgroundGrid: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.06,
    borderColor: 'rgba(255,255,255,0.08)',
    borderWidth: 0,
  },
  scrollContent: {
    paddingBottom: 44,
  },
  canvas: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 22,
  },
  canvasDesktop: {
    paddingHorizontal: 28,
    paddingTop: 20,
    gap: 28,
  },
  heroShell: {
    gap: 18,
  },
  heroShellDesktop: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 24,
  },
  heroContent: {
    padding: 20,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(10, 12, 16, 0.78)',
    gap: 16,
  },
  heroContentDesktop: {
    flex: 1.08,
    padding: 28,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandPulse: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#ff6b47',
    shadowColor: '#ff6b47',
    shadowOpacity: 0.52,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  brandLabel: {
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#f4f6f8',
    fontWeight: tokens.font.weight.bold,
  },
  brandDivider: {
    width: 26,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  brandMeta: {
    fontSize: 12,
    color: 'rgba(231, 235, 240, 0.62)',
  },
  heroTitle: {
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -1.4,
    color: '#f4f6f8',
    fontWeight: tokens.font.weight.semibold,
  },
  heroBody: {
    fontSize: 15,
    lineHeight: 24,
    color: 'rgba(231, 235, 240, 0.74)',
    maxWidth: 620,
  },
  heroCtaCard: {
    gap: 12,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  inputLabel: {
    fontSize: 12,
    color: 'rgba(231, 235, 240, 0.68)',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
    fontWeight: tokens.font.weight.semibold,
  },
  emailInput: {
    minHeight: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(9, 11, 15, 0.88)',
    paddingHorizontal: 16,
    color: '#f4f6f8',
    fontSize: 16,
  },
  heroButtonRow: {
    gap: 10,
  },
  heroButtonRowWide: {
    flexDirection: 'row',
  },
  primaryButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  submitButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 6,
  },
  primaryButtonFill: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: '#fff7f4',
    fontSize: 15,
    fontWeight: tokens.font.weight.semibold,
    letterSpacing: 0.2,
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.025)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryButtonText: {
    color: '#f4f6f8',
    fontSize: 15,
    fontWeight: tokens.font.weight.medium,
  },
  primaryButtonPressed: {
    opacity: 0.88,
  },
  secondaryButtonPressed: {
    opacity: 0.86,
  },
  buttonDisabled: {
    opacity: 0.58,
  },
  trustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  trustText: {
    fontSize: 12,
    color: 'rgba(231, 235, 240, 0.72)',
  },
  statusCard: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statusSuccess: {
    backgroundColor: 'rgba(37, 99, 78, 0.18)',
    borderColor: 'rgba(52, 211, 153, 0.24)',
  },
  statusDanger: {
    backgroundColor: 'rgba(127, 29, 29, 0.24)',
    borderColor: 'rgba(248, 113, 113, 0.22)',
  },
  statusText: {
    color: '#e7ebf0',
    fontSize: 13,
    lineHeight: 19,
  },
  heroVisualColumn: {
    position: 'relative',
  },
  heroVisualColumnDesktop: {
    flex: 0.92,
  },
  heroOrb: {
    position: 'absolute',
    top: 28,
    left: 18,
    right: 18,
    bottom: 18,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 90, 54, 0.12)',
  },
  heroVisualCard: {
    minHeight: 320,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(10, 12, 16, 0.72)',
    padding: 20,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  mockEyebrow: {
    fontSize: 12,
    color: 'rgba(231, 235, 240, 0.64)',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  heroMicWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  heroVisualMeta: {
    gap: 10,
  },
  heroVisualLine: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  heroVisualLineShort: {
    width: '64%',
  },
  signalPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  signalPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 122, 89, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255, 122, 89, 0.18)',
  },
  signalPillMuted: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  signalPillText: {
    fontSize: 12,
    color: '#ffd2c6',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  signalPillTextMuted: {
    color: 'rgba(231, 235, 240, 0.66)',
  },
  sectionHeader: {
    gap: 8,
    paddingTop: 6,
  },
  sectionEyebrow: {
    fontSize: 12,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: '#ff9a80',
  },
  sectionTitle: {
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.8,
    color: '#f4f6f8',
    fontWeight: tokens.font.weight.semibold,
  },
  sectionBody: {
    fontSize: 15,
    lineHeight: 23,
    color: 'rgba(231, 235, 240, 0.68)',
    maxWidth: 720,
  },
  demoGrid: {
    gap: 12,
  },
  demoGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  demoGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  demoCard: {
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(12, 15, 20, 0.82)',
    gap: 12,
  },
  demoCardSplit: {
    width: '49%',
  },
  demoCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  demoStep: {
    fontSize: 11,
    color: 'rgba(231, 235, 240, 0.48)',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  demoAccent: {
    fontSize: 11,
    color: '#ff9a80',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  demoSurface: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#0d1014',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  demoSurfaceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  demoDot: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: '#ff6b47',
  },
  demoStack: {
    gap: 8,
  },
  demoLine: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  demoLineLarge: {
    width: '100%',
  },
  demoLineMedium: {
    width: '80%',
  },
  demoLineShort: {
    width: '54%',
  },
  demoTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  demoTag: {
    width: 64,
    height: 24,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 122, 89, 0.16)',
  },
  demoTagMuted: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  cardTitle: {
    color: '#f4f6f8',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: tokens.font.weight.medium,
  },
  cardBody: {
    color: 'rgba(231, 235, 240, 0.66)',
    fontSize: 14,
    lineHeight: 21,
  },
  differenceGrid: {
    gap: 12,
  },
  differenceGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  differenceCard: {
    padding: 18,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(12, 15, 20, 0.72)',
    gap: 10,
  },
  differenceCardSplit: {
    width: '49%',
  },
  betaShell: {
    gap: 14,
    padding: 18,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(10, 12, 16, 0.86)',
  },
  betaShellDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
    padding: 24,
  },
  betaCopyBlock: {
    gap: 12,
  },
  betaCopyBlockDesktop: {
    flex: 0.92,
  },
  betaNotesCard: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 8,
  },
  formCard: {
    gap: 12,
    padding: 18,
    borderRadius: 22,
    backgroundColor: '#0d1014',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  formCardDesktop: {
    flex: 1.08,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  roleChipSelected: {
    backgroundColor: 'rgba(255, 122, 89, 0.14)',
    borderColor: 'rgba(255, 122, 89, 0.24)',
  },
  roleChipPressed: {
    opacity: 0.82,
  },
  roleChipText: {
    fontSize: 13,
    color: 'rgba(231, 235, 240, 0.72)',
  },
  roleChipTextSelected: {
    color: '#ffe0d7',
    fontWeight: tokens.font.weight.medium,
  },
  textArea: {
    minHeight: 122,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(9, 11, 15, 0.88)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#f4f6f8',
    fontSize: 15,
    lineHeight: 22,
  },
  formMeta: {
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(231, 235, 240, 0.56)',
  },
  footerCard: {
    paddingVertical: 18,
    paddingHorizontal: 8,
    gap: 8,
  },
  footerTitle: {
    color: '#f4f6f8',
    fontSize: 16,
    fontWeight: tokens.font.weight.medium,
  },
  footerBody: {
    color: 'rgba(231, 235, 240, 0.58)',
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 760,
  },
});