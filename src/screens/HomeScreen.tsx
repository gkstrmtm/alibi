import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useEffect } from 'react';
import { ActivityIndicator, Animated, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/store';
import { ListRow } from '../components/ListRow';
import { ScreenLayout } from '../components/ScreenLayout';
import { ScribbleMic } from '../components/ScribbleMic';
import { Section } from '../components/Section';
import { Toast } from '../components/Toast';
import { getLayoutMetrics } from '../theme/layout';
import { tokens } from '../theme/tokens';
import { useImportMedia } from '../hooks/useImportMedia';
import { triggerSoftFeedback } from '../utils/feedback';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const AnimatedPressable = ({ children, onPress, style, hitSlop, pulse }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    if (pulse) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.035, duration: 1700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1700, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [pulse, pulseAnim]);

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, tension: 150, friction: 10 }),
      Animated.spring(opacity, { toValue: 0.8, useNativeDriver: true, tension: 150, friction: 10 }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 150, friction: 10 }),
      Animated.spring(opacity, { toValue: 1, useNativeDriver: true, tension: 150, friction: 10 }),
    ]).start();
  };

  const currentScale = pulse ? Animated.multiply(scale, pulseAnim) : scale;

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} hitSlop={hitSlop}>
      <Animated.View style={[style, { transform: [{ scale: currentScale }], opacity }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { state } = useAppStore();
  const { width, height } = useWindowDimensions();
  const metrics = getLayoutMetrics(width, height);
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);
  const { importMedia, isImporting } = useImportMedia({ onMessage: setToastMessage });
  const [showFloatingMic, setShowFloatingMic] = React.useState(false);
  const floatingMicAnim = useRef(new Animated.Value(0)).current;
  const homeMicAnchor = useRef({ y: 0, height: 0 });

  function requireAuthThen(callback: () => void) {
    if (state.auth.status !== 'signedIn' || !state.auth.userId) {
      navigation.navigate('Auth');
      return;
    }
    callback();
  }

  useEffect(() => {
    Animated.spring(floatingMicAnim, {
      toValue: showFloatingMic ? 1 : 0,
      useNativeDriver: true,
      tension: 150,
      friction: 16,
    }).start();
  }, [floatingMicAnim, showFloatingMic]);

  function handleScroll(offsetY: number) {
    const triggerPoint = Math.max(0, homeMicAnchor.current.y + homeMicAnchor.current.height - 48);
    const shouldShow = offsetY > triggerPoint;
    setShowFloatingMic((current) => (current === shouldShow ? current : shouldShow));
  }

  

  const entries = Object.values(state.entries).sort((a, b) => b.createdAt - a.createdAt);
  const drafts = Object.values(state.drafts).sort((a, b) => b.createdAt - a.createdAt);
  const pinnedProjects = Object.values(state.projects)
    .filter((p) => p.pinned)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 2);

  const processing = entries.some((e) => e.status === 'processing');
  const latestDraft = drafts.length ? drafts[0] : undefined;
  const latestEntry = entries.length ? entries[0] : undefined;
  const latestCaptured = entries.find((e) => e.status === 'captured');

  let activeStep = 'Capture';
  if (latestDraft) activeStep = 'Shape';
  else if (latestCaptured) activeStep = 'Process';

  const primary = (() => {
    if (latestCaptured) {
      return {
        eyebrow: 'NEXT ACTION',
        title: 'Digest latest capture',
        subtitle: 'We’ll pull themes and directions — then you can file it.',
        cta: 'Open digest',
        onPress: () =>
          navigation.navigate('EntryDetail', {
            entryId: latestCaptured.id,
            autoExtract: Boolean(latestCaptured.audioUri),
          }),
      };
    }
    if (latestDraft) {
      return {
        eyebrow: 'CONTINUE',
        title: 'Refine your draft',
        subtitle: 'Review, edit, and export.',
        cta: 'Review draft',
        onPress: () => navigation.navigate('Output', { draftId: latestDraft.id }),
      };
    }
    if (latestEntry) {
      return {
        eyebrow: 'CONTINUE',
        title: 'Return to latest',
        subtitle: 'Digest it or attach to a project.',
        cta: 'Open entry',
        onPress: () => navigation.navigate('EntryDetail', { entryId: latestEntry.id }),
      };
    }
    return {
      eyebrow: 'START',
      title: 'Begin thinking',
      subtitle: 'Record freely. We’ll extract the signal.',
      cta: 'Record',
      onPress: () => navigation.navigate('Recording', { source: 'home' }),
    };
  })();

  return (
    <ScreenLayout title="" headerShown={false} contentPaddingHorizontal={0} contentPaddingTop={0}>
      <Toast message={toastMessage} tone="default" onHide={() => setToastMessage(null)} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        bounces={false}
        scrollEventThrottle={16}
        onScroll={(event) => handleScroll(event.nativeEvent.contentOffset.y)}
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: metrics.headerTopGap,
            paddingHorizontal: metrics.horizontalFrame,
            paddingBottom: metrics.stickyBottomSpace,
            gap: metrics.sectionGap * 1.5,
          },
        ]}
      >
        <Animated.View style={[styles.headerZone, { minHeight: metrics.headerMinHeight }]}> 
          <View style={styles.headerRow}>
             <View style={styles.headerTextBlock}>
              <Text style={styles.pageTitle}>ALIBI</Text>
              <Text style={styles.pageSubtitle}>The studio is ready.</Text>
            </View>
            {processing ? (
              <View style={styles.processingRow}>
                <ActivityIndicator size="small" color={tokens.color.textFaint} />
                <Text style={styles.processing}>PROCESSING</Text>
              </View>
            ) : null}
          </View>
        </Animated.View>

                <AnimatedPressable
          onPress={primary.onPress}
          style={[styles.heroCard, { minHeight: metrics.heroHeight }]}
        >
          <View style={styles.processTimeline}>
            <View style={styles.timelineNode}>
              <View style={[styles.timelineDot, activeStep === 'Capture' && styles.timelineDotActive]} />
              <Text style={[styles.timelineLabel, activeStep === 'Capture' && styles.timelineLabelActive]}>Capture</Text>
            </View>
            <View style={[styles.timelineLine, { left: '15%', right: '-15%' }, (activeStep === 'Process' || activeStep === 'Shape') && styles.timelineLineActive]} />
            
            <View style={styles.timelineNode}>
              <View style={[styles.timelineDot, activeStep === 'Process' && styles.timelineDotActive]} />
              <Text style={[styles.timelineLabel, activeStep === 'Process' && styles.timelineLabelActive]}>Digest</Text>
            </View>
            <View style={[styles.timelineLine, { left: '45%', right: '-45%' }, activeStep === 'Shape' && styles.timelineLineActive]} />

            <View style={styles.timelineNode}>
              <View style={[styles.timelineDot, activeStep === 'Shape' && styles.timelineDotActive]} />
              <Text style={[styles.timelineLabel, activeStep === 'Shape' && styles.timelineLabelActive]}>Shape</Text>
            </View>
          </View>

          <View style={styles.heroCopy}>
            <Text style={styles.primaryTitle}>{primary.title}</Text>
            <Text style={styles.primarySubtitle}>{primary.subtitle}</Text>
          </View>

          <View style={styles.heroFooter}>
            <Text style={styles.primaryCtaTextAlt}>{primary.cta}</Text>
            <Ionicons name="arrow-forward" size={16} color={tokens.color.brand} />
          </View>
        </AnimatedPressable>

        <View
          style={styles.recordActionContainer}
          onLayout={(event) => {
            homeMicAnchor.current = {
              y: event.nativeEvent.layout.y,
              height: event.nativeEvent.layout.height,
            };
          }}
        >
          <AnimatedPressable
            hitSlop={24}
            onPress={() => requireAuthThen(() => {
              triggerSoftFeedback();
              navigation.navigate('Recording', { source: 'home' });
            })}
            style={styles.dominantRecordButton}
          >
            <ScribbleMic size={156} iconSize={46} aggressive />
          </AnimatedPressable>
        </View>

        <View style={[styles.secondaryRow, { minHeight: metrics.secondaryZoneHeight * 0.8 }]}> 
          <AnimatedPressable
            onPress={() => navigation.navigate('TypeNote', { source: 'home' })}
            style={styles.secondaryAction}
          >
            <Ionicons name="create-outline" size={24} color={tokens.color.text} />
            <Text style={styles.secondaryLabel}>TYPE</Text>
          </AnimatedPressable>

          <AnimatedPressable
              onPress={importMedia}
              style={[styles.secondaryAction, isImporting && { opacity: 0.5 }]}
            >
              <Ionicons name="cloud-upload-outline" size={24} color={tokens.color.text} />
              <Text style={styles.secondaryLabel}>{isImporting ? 'IMPORTING...' : 'IMPORT'}</Text>
          </AnimatedPressable>
        </View>

        {pinnedProjects.length ? (
          <Section title="PINNED PROJECTS">
            {pinnedProjects.map((p) => (
                <ListRow key={p.id} onPress={() => navigation.navigate('ProjectDetail', { projectId: p.id })}
                  title={p.name}
                  subtitle={
                    p.type === 'book'
                      ? `${p.entryIds.length} SOURCES • ${p.draftIds.length} DRAFTS`
                      : `${p.entryIds.length} SOURCES • ${p.draftIds.length} DRAFTS`
                  }
                />
            ))}
          </Section>
        ) : null}

        <Section title="RECENT MATERIAL">
          {entries.slice(0, 5).map((e) => (
              <ListRow key={e.id} onPress={() => navigation.navigate('EntryDetail', { entryId: e.id })} 
                title={e.title}
                description={e.status === 'extracted' ? (e.themes?.[0] || 'Refined thought') : 'Raw capture'}
                subtitle={new Date(e.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).toUpperCase()}
                right={e.status === 'extracted' ? undefined : e.status.toUpperCase()}
              />
          ))}
          {!entries.length ? (
             <View style={styles.emptyCard}>
               <Text style={styles.emptyTitle}>The floor is clear. Voice your first thought.</Text>
               <Text style={styles.emptySubtitle}>Start with voice, typing, or an import. The feed will emerge.</Text>
             </View>
          ) : null}
        </Section>
      </ScrollView>

      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <Animated.View
          pointerEvents={showFloatingMic ? 'auto' : 'none'}
          style={[
            styles.floatingMicWrap,
            {
              right: 18,
              bottom: metrics.bottomNavHeight + 12,
              opacity: floatingMicAnim,
              transform: [
                {
                  translateY: floatingMicAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [22, 0],
                  }),
                },
                {
                  scale: floatingMicAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <Pressable
            hitSlop={16}
            onPress={() => requireAuthThen(() => {
              triggerSoftFeedback();
              navigation.navigate('Recording', { source: 'home' });
            })}
          >
            <ScribbleMic size={76} iconSize={26} aggressive />
          </Pressable>
        </Animated.View>
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
  },
  headerZone: {
    justifyContent: 'flex-end',
    marginBottom: tokens.space[8],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: tokens.space[12],
  },
  headerTextBlock: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '300',
    letterSpacing: 4,
    color: tokens.color.text,
  },
  pageSubtitle: {
    fontSize: tokens.font.size[14],
    color: tokens.color.textMuted,
    marginTop: tokens.space[8],
    letterSpacing: 1,
    opacity: 0.6,
  },
  processing: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: '700',
    color: tokens.color.textFaint,
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[8],
    paddingBottom: 2,
  },
  heroCard: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(28, 28, 30, 0.85)',
    borderRadius: 16,
    padding: tokens.space[24],
    justifyContent: 'space-between',
    gap: tokens.space[24],
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 4,
  },
  heroCopy: {
    gap: tokens.space[8],
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space[16],
  },
  heroButtonWrap: {
    flex: 1,
  },
  primaryCtaTextAlt: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.5,
    color: tokens.color.textMuted,
    textTransform: 'uppercase',
  },
  recordActionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: tokens.space[20],
  },
  dominantRecordButton: {
    width: 156,
    height: 156,
    borderRadius: 78,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  floatingMicWrap: {
    position: 'absolute',
    zIndex: 30,
  },
  processTimeline: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: tokens.space[16],
    position: 'relative',
    paddingHorizontal: tokens.space[8],
  },
  timelineNode: {
    alignItems: 'center',
    gap: 8,
    zIndex: 2,
    flex: 1,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: tokens.color.border,
  },
  timelineDotActive: {
    backgroundColor: tokens.color.brand,
    shadowColor: tokens.color.brand,
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  timelineLine: {
    position: 'absolute',
    top: 5,
    width: '33%',
    height: 1,
    backgroundColor: tokens.color.border,
    zIndex: 1,
  },
  timelineLineActive: {
    backgroundColor: tokens.color.brand,
  },
  timelineLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#8A8A8A',
    textTransform: 'uppercase',
  },
  timelineLabelActive: {
    color: tokens.color.brand,
  },
  primaryTitle: {
    fontSize: 26,
    fontWeight: '500',
    color: '#F4F4F4',
    lineHeight: 32,
    letterSpacing: 0.5,
  },
  primarySubtitle: {
    fontSize: 14,
    fontWeight: '400',
    color: '#A3A3A3',
    lineHeight: 22,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: tokens.space[16],
  },
  secondaryAction: {
    flex: 1,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface,
    borderRadius: 16,
    paddingHorizontal: tokens.space[16],
    paddingVertical: tokens.space[16],
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space[12],
  },
  secondaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    color: tokens.color.textMuted,
  },
  emptyCard: {
    padding: tokens.space[24],
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    backgroundColor: 'rgba(20,20,25,0.3)',
    borderRadius: 16,
    gap: tokens.space[12],
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0.5,
    color: tokens.color.text,
  },
  emptySubtitle: {
    fontSize: 12,
    lineHeight: 20,
    fontWeight: '300',
    color: tokens.color.textMuted,
    textAlign: 'center',
    opacity: 0.6,
  },
});
