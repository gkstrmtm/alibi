import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useEffect } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import type { RootStackParamList } from '../navigation/types';
import { useImportMedia } from '../hooks/useImportMedia';
import { useAppStore } from '../store/store';
import { ListRow } from '../components/ListRow';
import { ScreenLayout } from '../components/ScreenLayout';
import { Section } from '../components/Section';
import { Toast } from '../components/Toast';
import { getLayoutMetrics } from '../theme/layout';
import { tokens } from '../theme/tokens';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const AnimatedPressable = ({ children, onPress, style, hitSlop }: any) => {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

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

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} hitSlop={hitSlop}>
      <Animated.View style={[style, { transform: [{ scale }], opacity }]}>{children}</Animated.View>
    </Pressable>
  );
};

const FadeInUp = ({ children, delay = 0 }: any) => {
  const translateY = useRef(new Animated.Value(20)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8, delay }),
      Animated.timing(opacity, { toValue: 1, useNativeDriver: true, duration: 400, delay }),
    ]).start();
  }, []);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
};

export function VaultScreen() {
  const navigation = useNavigation<Nav>();
  const { state } = useAppStore();
  const { width, height } = useWindowDimensions();
  const metrics = getLayoutMetrics(width, height);
  const [filter, setFilter] = React.useState<'all' | 'attention' | 'processed' | 'unsorted'>('all');
  const [toastMessage, setToastMessage] = React.useState<string | null>(null);
  const { importMedia, isImporting } = useImportMedia({ onMessage: setToastMessage });

  const entries = Object.values(state.entries).sort((a, b) => b.createdAt - a.createdAt);
  const drafts = Object.values(state.drafts).sort((a, b) => b.createdAt - a.createdAt);
  const usedInDraftIdSet = (() => {
    const set = new Set<string>();
    for (const d of Object.values(state.drafts)) {
      for (const id of d.entryIds) set.add(id);
    }
    return set;
  })();
  const draftIdByEntryId = (() => {
    const map: Record<string, string> = {};
    for (const draft of drafts) {
      for (const entryId of draft.entryIds) {
        if (!map[entryId]) {
          map[entryId] = draft.id;
        }
      }
    }
    return map;
  })();

  const needsAttention = entries.filter((e) => e.status !== 'extracted');
  const processed = entries.filter((e) => e.status === 'extracted');
  const unsorted = entries.filter((e) => !e.projectId);
  const unsortedNeedsAttention = needsAttention.filter((e) => !e.projectId);
  const unsortedProcessed = processed.filter((e) => !e.projectId);
  
  const visibleNeedsAttention = filter === 'processed' ? [] : filter === 'unsorted' ? unsortedNeedsAttention : needsAttention;
  const visibleProcessed = filter === 'attention' ? [] : filter === 'unsorted' ? unsortedProcessed : processed;
  const isEmpty =
    filter === 'all'
      ? entries.length === 0
      : filter === 'attention'
        ? needsAttention.length === 0
        : filter === 'processed'
          ? processed.length === 0
          : unsorted.length === 0;

  function fmtDuration(totalSec?: number) {
    if (typeof totalSec !== 'number' || !Number.isFinite(totalSec) || totalSec < 0) return undefined;
    const sec = Math.floor(totalSec);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m <= 0) return `${s}S`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function fmtKind(kind: typeof entries[number]['kind']) {
    switch (kind) {
      case 'voice': return 'VOICE';
      case 'text': return 'NOTE';
      case 'import': return 'IMPORT';
      case 'video': return 'VIDEO';
      case 'upload': return 'FILE';
      default: return 'ENTRY';
    }
  }

  function fmtStamp(ts: number) {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).toUpperCase();
  }

  function fmtPlacement(projectId?: string) {
    if (!projectId) return 'UNSORTED';
    return (state.projects[projectId]?.name ?? 'ASSIGNED').toUpperCase();
  }

  return (
    <ScreenLayout title="" headerShown={false} contentPaddingHorizontal={0} contentPaddingTop={0}>
      <Toast message={toastMessage} tone="default" onHide={() => setToastMessage(null)} />
      <ScrollView overScrollMode="never" bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { gap: metrics.stackGap, paddingTop: metrics.headerTopGap, paddingHorizontal: metrics.horizontalFrame, paddingBottom: metrics.stickyBottomSpace }]}> 
        
        <Animated.View style={[styles.topZone, { minHeight: metrics.headerMinHeight }]}> 
          <View style={styles.topRow}>
            <View style={styles.topTextBlock}>
              <Text style={styles.pageTitle}>VAULT</Text>
              <Text style={styles.pageSubtitle}>An unstructured record of thought.</Text>
            </View>
            <AnimatedPressable hitSlop={16} onPress={importMedia}>
              <Text style={styles.topAction}>{isImporting ? 'IMPORTING…' : 'IMPORT'}</Text>
            </AnimatedPressable>
          </View>
        </Animated.View>

        <View style={styles.inlineStatsWrap}>
          <Text style={styles.inlineStatsText}>
             {entries.length} CAPTURES <Text style={{opacity: 0.3}}>—</Text> {needsAttention.length} FRESH <Text style={{opacity: 0.3}}>—</Text> {processed.length} PROCESSED
          </Text>
        </View>

        <View style={[styles.filterRow, { minHeight: metrics.secondaryZoneHeight * 0.68 }]}> 
          {[
            { key: 'all', label: 'ALL' },
            { key: 'attention', label: 'FRESH' },
            { key: 'processed', label: 'PROCESSED' },
            { key: 'unsorted', label: 'UNSORTED' },
          ].map((item) => (
            <AnimatedPressable
              key={item.key}
              onPress={() => setFilter(item.key as 'all' | 'attention' | 'processed' | 'unsorted')}
              style={[styles.filterChip, filter === item.key ? styles.filterChipActive : null]}
            >
              <Text style={[styles.filterChipText, filter === item.key ? styles.filterChipTextActive : null]}>{item.label}</Text>
            </AnimatedPressable>
          ))}
        </View>

        {isEmpty ? (
          <FadeInUp delay={100}>
            <View style={[styles.emptyState, { minHeight: metrics.emptyStateMinHeight }]}> 
              <Text style={styles.emptyTitle}>Your archive is resting.</Text>
              <Text style={styles.emptyCopy}>Start with whatever fits the moment: bring something in, record straight away, or type when you need a quiet path.</Text>
              <View style={styles.captureCardStack}>
                <AnimatedPressable style={[styles.captureCard, styles.captureCardFeatured, isImporting ? styles.captureCardDisabled : null]} onPress={importMedia}>
                  <View style={styles.captureCardTopRow}>
                    <View style={[styles.captureIconWrap, styles.captureIconWrapFeatured]}>
                      <Ionicons name="cloud-upload-outline" size={20} color={tokens.color.brand} />
                    </View>
                    <Text style={[styles.captureKicker, styles.captureKickerFeatured]}>{isImporting ? 'BRINGING IT IN' : 'DIRECT IMPORT'}</Text>
                  </View>
                  <View style={styles.captureCopy}>
                    <Text style={styles.captureTitle}>Import from device</Text>
                    <Text style={styles.captureDescription}>Pull in audio, video, transcripts, or files immediately. No detour screen.</Text>
                  </View>
                  <View style={styles.captureFooter}>
                    <Text style={styles.captureMeta}>Opens picker now</Text>
                    <Ionicons name="arrow-forward" size={16} color={tokens.color.brand} />
                  </View>
                </AnimatedPressable>

                <AnimatedPressable style={styles.captureCard} onPress={() => navigation.navigate('Recording', { source: 'vault' })}>
                  <View style={styles.captureCardTopRow}>
                    <View style={styles.captureIconWrap}>
                      <Ionicons name="mic-outline" size={20} color={tokens.color.text} />
                    </View>
                    <Text style={styles.captureKicker}>RECORD</Text>
                  </View>
                  <View style={styles.captureCopy}>
                    <Text style={styles.captureTitle}>Open recorder</Text>
                    <Text style={styles.captureDescription}>Jump straight into capture with the same recorder the global mic opens.</Text>
                  </View>
                  <View style={styles.captureFooter}>
                    <Text style={styles.captureMeta}>Fastest path</Text>
                    <Ionicons name="arrow-forward" size={16} color={tokens.color.textMuted} />
                  </View>
                </AnimatedPressable>

                <AnimatedPressable style={styles.captureCard} onPress={() => navigation.navigate('TypeNote', { source: 'vault' })}>
                  <View style={styles.captureCardTopRow}>
                    <View style={styles.captureIconWrap}>
                      <Ionicons name="create-outline" size={20} color={tokens.color.text} />
                    </View>
                    <Text style={styles.captureKicker}>TYPE</Text>
                  </View>
                  <View style={styles.captureCopy}>
                    <Text style={styles.captureTitle}>Type a note</Text>
                    <Text style={styles.captureDescription}>Capture the thought by hand when talking is not the move.</Text>
                  </View>
                  <View style={styles.captureFooter}>
                    <Text style={styles.captureMeta}>Quiet path</Text>
                    <Ionicons name="arrow-forward" size={16} color={tokens.color.textMuted} />
                  </View>
                </AnimatedPressable>
              </View>
            </View>
          </FadeInUp>
        ) : null}

        {drafts.length ? (
          <Section title="SAVED DRAFTS">
            <View style={styles.list}>
              {drafts.map((draft, i) => {
                const projectName = draft.projectId ? state.projects[draft.projectId]?.name : undefined;
                const openDraft = () => navigation.navigate('Output', { draftId: draft.id });
                return (
                  <FadeInUp key={draft.id} delay={i * 40}>
                    <AnimatedPressable onPress={openDraft}>
                      <ListRow
                        onPress={openDraft}
                        title={draft.title}
                        description={projectName ? `From ${projectName}` : 'Unfiled draft'}
                        subtitle={`${draft.format.replace(/-/g, ' ')} • v${draft.version} • ${fmtStamp(draft.createdAt)}`}
                        right="DRAFT"
                      />
                    </AnimatedPressable>
                  </FadeInUp>
                );
              })}
            </View>
          </Section>
        ) : null}

        {visibleNeedsAttention.length ? (
          <Section title="FRESH CAPTURES">
            <View style={styles.list}>
              {visibleNeedsAttention.map((e, i) => {
                const stage = e.status === 'processing' ? 'DIGESTING' : e.projectId ? 'CAPTURED' : 'UNSORTED';
                const openEntry = () =>
                  navigation.navigate('EntryDetail', {
                    entryId: e.id,
                    autoExtract: Boolean(e.audioUri) && e.status === 'captured',
                  });
                return (
                  <FadeInUp key={e.id} delay={i * 50}>
                    <AnimatedPressable onPress={openEntry}>
                      <ListRow onPress={openEntry} 
                        title={e.title}
                        subtitle={
                          (() => {
                            const parts = [fmtKind(e.kind)];
                            const dur = e.kind === 'voice' ? fmtDuration(e.durationSec) : undefined;
                            if (dur) parts.push(dur);
                            parts.push(fmtPlacement(e.projectId));
                            parts.push(fmtStamp(e.createdAt));
                            return parts.join(' • ');
                          })()
                        }
                        right={stage}
                      />
                    </AnimatedPressable>
                  </FadeInUp>
                );
              })}
            </View>
          </Section>
        ) : null}

        {visibleProcessed.length ? (
          <Section title={filter === 'unsorted' ? 'PROCESSED BUT UNSORTED' : 'PROCESSED'}>
            <View style={styles.list}>
              {visibleProcessed.map((e, i) => {
                const drafted = usedInDraftIdSet.has(e.id);
                const assigned = Boolean(e.projectId);
                const stage = drafted ? 'DRAFTED' : assigned ? 'ASSIGNED' : 'UNSORTED';
                const linkedDraftId = draftIdByEntryId[e.id];
                const linkedDraft = linkedDraftId ? state.drafts[linkedDraftId] : undefined;
                const openProcessed = () => {
                  if (linkedDraftId) {
                    navigation.navigate('Output', { draftId: linkedDraftId });
                    return;
                  }
                  navigation.navigate('EntryDetail', { entryId: e.id });
                };
                return (
                   <FadeInUp key={e.id} delay={i * 50}>
                    <AnimatedPressable onPress={openProcessed}>
                      <ListRow onPress={openProcessed} 
                        title={e.title}
                        description={linkedDraft ? `Used in ${linkedDraft.title}` : undefined}
                        subtitle={
                          (() => {
                            const parts = [fmtKind(e.kind)];
                            const dur = e.kind === 'voice' ? fmtDuration(e.durationSec) : undefined;
                            if (dur) parts.push(dur);
                            if (e.themes?.[0]) parts.push(e.themes[0].toUpperCase());
                            parts.push(fmtPlacement(e.projectId));
                            parts.push(fmtStamp(e.createdAt));
                            return parts.join(' • ');
                          })()
                        }
                        right={stage}
                      />
                    </AnimatedPressable>
                  </FadeInUp>
                );
              })}
            </View>
          </Section>
        ) : null}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
  },
  topZone: {
    justifyContent: 'flex-end',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: tokens.space[12],
  },
  topTextBlock: {
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
  inlineStatsWrap: {
    paddingVertical: tokens.space[8],
  },
  inlineStatsText: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
    color: tokens.color.textMuted,
    opacity: 0.8,
  },
  list: {
    gap: tokens.space[16],
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space[12],
    alignItems: 'center',
    marginBottom: tokens.space[8],
  },
  filterChip: {
    paddingVertical: tokens.space[8],
    paddingHorizontal: tokens.space[16],
    borderRadius: 999,
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  filterChipActive: {
    backgroundColor: tokens.color.surface2,
    borderColor: tokens.color.border,
  },
  filterChipText: {
    fontSize: 10,
    color: tokens.color.textMuted,
    fontWeight: '700',
    letterSpacing: 2,
  },
  filterChipTextActive: {
    color: tokens.color.text,
  },
  emptyState: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius[24],
    padding: tokens.space[24],
    justifyContent: 'center',
    gap: tokens.space[16],
  },
  emptyTitle: {
    fontSize: tokens.font.size[18],
    color: tokens.color.text,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  emptyCopy: {
    fontSize: tokens.font.size[14],
    color: tokens.color.textMuted,
    lineHeight: 22,
    fontWeight: '300',
    opacity: 0.7,
  },
  captureCardStack: {
    gap: tokens.space[12],
    marginTop: tokens.space[8],
  },
  captureCard: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface2,
    borderRadius: tokens.radius[16],
    padding: tokens.space[16],
    gap: tokens.space[12],
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  captureCardFeatured: {
    backgroundColor: '#FFF5F2',
    borderColor: 'rgba(255, 56, 35, 0.2)',
  },
  captureCardDisabled: {
    opacity: 0.6,
  },
  captureCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space[12],
  },
  captureIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureIconWrapFeatured: {
    borderColor: 'rgba(255, 56, 35, 0.24)',
    backgroundColor: '#FFFFFF',
  },
  captureKicker: {
    flex: 1,
    textAlign: 'right',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    color: tokens.color.textMuted,
    textTransform: 'uppercase',
  },
  captureKickerFeatured: {
    color: tokens.color.brand,
  },
  captureCopy: {
    gap: tokens.space[8],
  },
  captureTitle: {
    fontSize: tokens.font.size[16],
    fontWeight: '500',
    color: tokens.color.text,
  },
  captureDescription: {
    fontSize: tokens.font.size[14],
    lineHeight: 20,
    color: tokens.color.textMuted,
  },
  captureFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space[12],
  },
  captureMeta: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.4,
    color: tokens.color.textMuted,
  },
  topAction: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    color: tokens.color.brand, // Brand sprinkle
  },
});
