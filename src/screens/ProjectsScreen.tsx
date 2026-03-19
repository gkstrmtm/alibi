import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useEffect } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/store';
import { ListRow } from '../components/ListRow';
import { ScreenLayout } from '../components/ScreenLayout';
import { Section } from '../components/Section';
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

const FadeInUp = ({ children, delay = 0, style }: any) => {
  const translateY = useRef(new Animated.Value(20)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 50, friction: 8, delay }),
      Animated.timing(opacity, { toValue: 1, useNativeDriver: true, duration: 400, delay }),
    ]).start();
  }, []);

  return <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
};

export function ProjectsScreen() {
  const navigation = useNavigation<Nav>();
  const { state } = useAppStore();
  const { width, height } = useWindowDimensions();
  const metrics = getLayoutMetrics(width, height);

  function projectLastActivity(projectId: string): number {
    const p = state.projects[projectId];
    if (!p) return 0;
    let t = p.createdAt;
    for (const id of p.entryIds) {
      const e = state.entries[id];
      if (e?.createdAt && e.createdAt > t) t = e.createdAt;
    }
    for (const id of p.draftIds) {
      const d = state.drafts[id];
      if (d?.createdAt && d.createdAt > t) t = d.createdAt;
    }
    return t;
  }

  const projects = Object.values(state.projects).sort((a, b) => {
    const diff = projectLastActivity(b.id) - projectLastActivity(a.id);
    if (diff !== 0) return diff;
    return Number(b.pinned) - Number(a.pinned);
  });

  const activeProject = projects[0];

  function formatShortDate(ts: number): string {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function describeProjectBody(projectId: string): string {
    const p = state.projects[projectId];
    if (!p) return '';
    const sourceLabel = `${p.entryIds.length} ${p.entryIds.length === 1 ? 'entry' : 'entries'}`;
    const draftLabel = `${p.draftIds.length} ${p.draftIds.length === 1 ? 'draft' : 'drafts'}`;
    return `${p.type === 'book' ? 'Book' : 'Project'} · ${sourceLabel} · ${draftLabel}`;
  }

  function describeProjectState(projectId: string): string {
    const p = state.projects[projectId];
    if (!p) return '';
    if (p.draftIds.length > 0) return 'Entries are already turning into shaped writing.';
    if (p.entryIds.length > 0) return 'Entries are gathering. Threads are still condensing.';
    return 'Clean shell. Ready for the first real entry.';
  }

  return (
    <ScreenLayout title="" headerShown={false} contentPaddingHorizontal={0} contentPaddingTop={0}>
      <ScrollView overScrollMode="never" bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { gap: metrics.stackGap, paddingTop: metrics.headerTopGap, paddingHorizontal: metrics.horizontalFrame, paddingBottom: metrics.stickyBottomSpace }]}> 
        <Animated.View style={[styles.topZone, { minHeight: metrics.headerMinHeight }]}> 
          <View style={styles.topRow}>
            <View style={styles.topTextBlock}>
              <Text style={styles.pageTitle}>WORKSPACE</Text>
              <Text style={styles.pageSubtitle}>Bodies of work taking shape.</Text>
            </View>
            <AnimatedPressable hitSlop={16} onPress={() => navigation.navigate('NewProject')}>
              <Text style={styles.topAction}>NEW</Text>
            </AnimatedPressable>
          </View>
        </Animated.View>

        <View style={styles.inlineStatsWrap}>
          <Text style={styles.inlineStatsText}>
             {projects.length} PROJECTS <Text style={{opacity: 0.3}}>—</Text> {projects.filter(p => p.pinned).length} PINNED
          </Text>
        </View>

        {activeProject ? (
          <FadeInUp delay={100}>
            <AnimatedPressable 
              style={[styles.heroCard, { minHeight: metrics.heroHeight * 0.82 }]}
              onPress={() => navigation.navigate('ProjectDetail', { projectId: activeProject.id })}
            >
              <View style={styles.heroCopy}>
                <Text style={styles.heroEyebrow}>MOST ACTIVE</Text>
                <Text style={styles.heroTitle}>{activeProject.name.toUpperCase()}</Text>
                <Text style={styles.heroSubtitle}>{describeProjectState(activeProject.id)}</Text>
                <Text style={styles.heroActivity}>{`${describeProjectBody(activeProject.id)} · active ${formatShortDate(projectLastActivity(activeProject.id)).toUpperCase()}`}</Text>
              </View>
              <View style={styles.heroFooter}>
                <View style={styles.heroIndicator}>
                  <Text style={styles.heroIndicatorText}>OPEN</Text>
                  <Ionicons name="arrow-forward" size={14} color="#A3A3A3" />
                </View>
              </View>
            </AnimatedPressable>
          </FadeInUp>
        ) : null}

        {projects.length ? (
          <Section title="ALL PROJECTS">
            <View style={styles.list}>
              {projects.map((p, i) => (
                <FadeInUp key={p.id} delay={150 + i * 50}>
                  <ListRow
                    onPress={() => navigation.navigate('ProjectDetail', { projectId: p.id })}
                    title={p.name}
                    description={describeProjectBody(p.id)}
                    subtitle={`${describeProjectState(p.id)}${projectLastActivity(p.id) ? ` · Active ${formatShortDate(projectLastActivity(p.id)).toUpperCase()}` : ''}`}
                    right={p.pinned ? 'PINNED' : undefined}
                  />
                </FadeInUp>
              ))}
            </View>
          </Section>
        ) : (
          <FadeInUp delay={200}>
            <View style={[styles.emptyState, { minHeight: metrics.emptyStateMinHeight }]}> 
              <Text style={styles.emptyTitle}>CLEAR SURFACE</Text>
              <Text style={styles.emptyCopy}>Establish a new project to give your wandering ideas a definite structure.</Text>
              <View style={styles.emptyActions}>
                <AnimatedPressable style={styles.actionBtn} onPress={() => navigation.navigate('NewProject')}>
                  <Text style={styles.actionBtnText}>CREATE PROJECT</Text>
                  <Ionicons name="add" size={14} color="#FFFFFF" />
                </AnimatedPressable>
              </View>
            </View>
          </FadeInUp>
        )}
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
    paddingBottom: tokens.space[16],
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  topTextBlock: {
    gap: tokens.space[4],
  },
  pageTitle: {
    fontSize: tokens.font.size[24],
    fontWeight: tokens.font.weight.bold,
    color: tokens.color.text,
    letterSpacing: 2,
  },
  pageSubtitle: {
    fontSize: tokens.font.size[14],
    color: tokens.color.textMuted,
  },
  topAction: {
    fontSize: tokens.font.size[12],
    fontWeight: tokens.font.weight.bold,
    color: tokens.color.brand, // Sprinkle accent color here
    letterSpacing: 1,
  },
  inlineStatsWrap: {
    borderBottomWidth: 1,
    borderBottomColor: tokens.color.borderSubtle,
    paddingBottom: tokens.space[16],
  },
  inlineStatsText: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 1,
  },
  heroCard: {
    padding: tokens.space[20],
    borderRadius: tokens.radius[16],
    justifyContent: 'space-between',
    gap: tokens.space[16],
    backgroundColor: 'rgba(28, 28, 30, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 4,
  },
  heroCopy: {
    gap: tokens.space[8],
  },
  heroEyebrow: {
    fontSize: tokens.font.size[12],
    fontWeight: '700',
    color: '#A3A3A3',
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#F4F4F4',
    letterSpacing: 0.5,
  },
  heroSubtitle: {
    fontSize: 13,
    color: '#D0D0D0',
    fontWeight: '500',
    lineHeight: 18,
  },
  heroActivity: {
    fontSize: 11,
    color: '#8A8A8A',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heroFooter: {},
  heroIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: tokens.space[8],
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  heroIndicatorText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#A3A3A3',
    letterSpacing: 2,
  },
  list: {
    gap: tokens.space[12],
  },
  emptyState: {
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    borderRadius: tokens.radius[16],
    padding: tokens.space[20],
    justifyContent: 'center',
    gap: tokens.space[16],
  },
  emptyTitle: {
    fontSize: tokens.font.size[16],
    fontWeight: tokens.font.weight.bold,
    color: tokens.color.text,
    letterSpacing: 1,
  },
  emptyCopy: {
    fontSize: tokens.font.size[14],
    color: tokens.color.textMuted,
    lineHeight: 20,
  },
  emptyActions: {
    flexDirection: 'column',
    gap: tokens.space[8],
    marginTop: tokens.space[8],
  },
  actionBtn: {
    width: '100%',
    backgroundColor: '#111111',
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.space[16],
    borderWidth: 1,
    borderColor: '#111111',
    borderRadius: tokens.radius[16],
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
