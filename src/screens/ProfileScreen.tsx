import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';

import { Button } from '../components/Button';
import { ScreenLayout } from '../components/ScreenLayout';
import { Section } from '../components/Section';
import { GradientText } from '../components/GradientText';
import { getSupabaseConfig } from '../config/supabase';
import type { RootStackParamList } from '../navigation/types';
import { useAppStore } from '../store/store';
import { getSupabaseClient } from '../supabase/client';
import { supabaseGetMyProfile, supabaseUpdateMyProfile } from '../supabase/profile';
import { getLayoutMetrics } from '../theme/layout';
import { tokens } from '../theme/tokens';
import { getEntryRecordedSeconds } from '../utils/entryDuration';

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

const RECORDING_GOALS = [1, 3, 10, 25, 50] as const;
const CHARM_MILESTONES = [
  { hours: 0.5, name: 'First Thread', color: '#E85DFF' },
  { hours: 1, name: 'Signal Lock', color: '#374AF6' },
  { hours: 3, name: 'Pattern Library', color: '#00A3FF' },
  { hours: 10, name: 'Working Voice', color: '#14B8A6' },
  { hours: 25, name: 'System Builder', color: '#5B6CFF' },
  { hours: 100, name: 'Long-Form Engine', color: '#0029E8' },
] as const;
const STAT_TONES = [
  { backgroundColor: 'rgba(55, 74, 246, 0.08)', borderColor: 'rgba(55, 74, 246, 0.20)', accentColor: '#374AF6' },
  { backgroundColor: 'rgba(20, 184, 166, 0.09)', borderColor: 'rgba(20, 184, 166, 0.22)', accentColor: '#14B8A6' },
  { backgroundColor: 'rgba(0, 163, 255, 0.08)', borderColor: 'rgba(0, 163, 255, 0.20)', accentColor: '#00A3FF' },
  { backgroundColor: 'rgba(0, 41, 232, 0.08)', borderColor: 'rgba(0, 41, 232, 0.20)', accentColor: '#0029E8' },
] as const;
const STOP_WORDS = new Set([
  'the', 'and', 'that', 'with', 'from', 'this', 'have', 'your', 'about', 'what', 'when', 'they', 'them', 'into', 'then', 'just', 'like', 'really', 'because', 'there', 'would', 'could', 'should', 'been', 'were', 'while', 'where', 'which', 'their', 'more', 'some', 'very', 'over', 'only', 'than', 'also', 'still', 'through', 'thing', 'things', 'make', 'made', 'want', 'need', 'talk', 'talking', 'said', 'says', 'each', 'much', 'will', 'dont', 'cant', 'youre', 'its', 'im', 'ive', 'our', 'out', 'for', 'are', 'but', 'not', 'all', 'any', 'too', 'how', 'why', 'who', 'use', 'using', 'used', 'being', 'here', 'across', 'most', 'often', 'showing', 'show', 'keep', 'keeps', 'gets', 'getting', 'did', 'does', 'done', 'let', 'lets', 'got', 'going', 'kind', 'sort', 'actually', 'maybe', 'probably', 'little', 'good', 'better', 'best', 'well', 'right', 'left', 'work', 'works', 'working'
]);

function formatRecordedValue(totalSeconds: number) {
  if (totalSeconds <= 0) return '0 min';

  if (totalSeconds < 3600) {
    const minutes = Math.max(1, Math.round(totalSeconds / 60));
    return `${minutes} min`;
  }

  const hours = totalSeconds / 3600;
  return `${hours < 10 ? hours.toFixed(1) : hours.toFixed(0)} hr`;
}

function formatRecordedStatValue(totalSeconds: number) {
  if (totalSeconds <= 0) return '0m';
  if (totalSeconds < 3600) return `${Math.max(1, Math.round(totalSeconds / 60))}m`;

  const hours = totalSeconds / 3600;
  return `${hours < 10 ? hours.toFixed(1) : hours.toFixed(0)}h`;
}

function formatGoalValue(goalHours: number) {
  if (goalHours < 1) return `${Math.round(goalHours * 60)} min`;
  return `${goalHours % 1 === 0 ? goalHours.toFixed(0) : goalHours.toFixed(1)} hr`;
}

function formatMilestoneLabel(hours: number) {
  if (hours < 1) {
    return `${Math.round(hours * 60)} min`;
  }

  return `${hours % 1 === 0 ? hours.toFixed(0) : hours.toFixed(1)} hr`;
}

function countWords(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function describeCharm(hours: number) {
  if (hours <= 0.5) return 'You have enough raw material to start noticing a real thread.';
  if (hours <= 1) return 'Your captures are beginning to repeat and hold signal.';
  if (hours <= 3) return 'Patterns are strong enough to reuse across projects and drafts.';
  if (hours <= 10) return 'Your voice is becoming operational, not accidental.';
  if (hours <= 25) return 'You have enough material to build systems instead of isolated notes.';
  return 'You are operating with enough source to sustain serious long-form work.';
}

function maskMilestoneName(name: string, unlocked: boolean) {
  if (unlocked) return name;
  return name.replace(/[A-Za-z0-9]/g, '•');
}

function formatShortDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(timestamp));
}

function isMeaningfulDisplayName(value?: string) {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  return trimmed.toLowerCase() !== 'unnamed user';
}

function deriveAccountName(displayName?: string, email?: string) {
  if (isMeaningfulDisplayName(displayName)) {
    return displayName!.trim();
  }

  const emailName = email?.split('@')[0]?.trim();
  if (emailName) {
    return emailName;
  }

  return 'Account';
}

function getCaptureStreakDays(timestamps: number[]) {
  if (!timestamps.length) {
    return 0;
  }

  const days = Array.from(
    new Set(
      timestamps
        .map((timestamp) => {
          const d = new Date(timestamp);
          d.setHours(0, 0, 0, 0);
          return d.getTime();
        })
        .sort((a, b) => b - a),
    ),
  );

  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  for (const day of days) {
    if (day === cursor.getTime()) {
      streak += 1;
      cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
      continue;
    }

    if (streak === 0 && day === cursor.getTime() - 24 * 60 * 60 * 1000) {
      streak += 1;
      cursor = new Date(day - 24 * 60 * 60 * 1000);
      continue;
    }

    break;
  }

  return streak;
}

function getRecentWeekRecordingBars(entries: { createdAt: number; durationSec?: number }[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const bars = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getTime() - (6 - index) * 24 * 60 * 60 * 1000);
    return {
      key: date.toISOString(),
      label: labels[date.getDay()],
      dayStart: date.getTime(),
      seconds: 0,
    };
  });

  entries.forEach((entry) => {
    const date = new Date(entry.createdAt);
    date.setHours(0, 0, 0, 0);
    const bar = bars.find((item) => item.dayStart === date.getTime());
    if (bar) {
      bar.seconds += Math.max(0, entry.durationSec || 0);
    }
  });

  const maxSeconds = Math.max(...bars.map((bar) => bar.seconds), 1);

  return bars.map((bar) => ({
    ...bar,
    ratio: bar.seconds <= 0 ? 0.08 : Math.max(0.16, bar.seconds / maxSeconds),
  }));
}

function extractSignalTerms(entries: Array<{ transcript?: string; themes?: string[]; highlights?: string[] }>, drafts: Array<{ content: string }>) {
  const scored = new Map<string, number>();

  entries.forEach((entry) => {
    (entry.themes ?? []).forEach((theme) => {
      const key = theme.trim().toLowerCase();
      if (!key) return;
      scored.set(key, (scored.get(key) ?? 0) + 4);
    });

    (entry.highlights ?? []).forEach((highlight) => {
      highlight
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length >= 4 && !STOP_WORDS.has(word))
        .forEach((word) => scored.set(word, (scored.get(word) ?? 0) + 1));
    });
  });

  drafts.forEach((draft) => {
    draft.content
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 5 && !STOP_WORDS.has(word))
      .forEach((word) => scored.set(word, (scored.get(word) ?? 0) + 1));
  });

  return [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([term]) => term.replace(/(^.|\s+.)/g, (part) => part.toUpperCase()));
}

function analyzeVoiceProfile(
  entries: Array<{ kind?: string; transcript?: string; themes?: string[]; highlights?: string[] }>,
  drafts: Array<{ content: string }>,
  projects: Array<{ type: string }>,
) {
  const transcriptText = entries
    .map((entry) => [entry.transcript ?? '', ...(entry.themes ?? []), ...(entry.highlights ?? [])].join(' '))
    .join(' ')
    .toLowerCase();
  const draftText = drafts.map((draft) => draft.content ?? '').join(' ').toLowerCase();
  const corpus = `${transcriptText} ${draftText}`.trim();
  const words = corpus.split(/\s+/).filter(Boolean);

  if (words.length < 120) {
    return {
      title: 'Profile signal builds from real material',
      note: 'Add a few real captures and drafts, then this area starts reflecting the patterns that actually show up in your work.',
      traits: [],
      signals: [],
      styleLabel: undefined,
      isReady: false,
    };
  }

  const score = (terms: string[]) => terms.reduce((sum, term) => sum + (corpus.match(new RegExp(`\\b${term}\\b`, 'g'))?.length ?? 0), 0);

  const buckets = [
    {
      key: 'reflective',
      title: 'Reflective',
      terms: ['feel', 'meaning', 'wonder', 'memory', 'honest', 'truth', 'inner', 'why', 'reflect'],
    },
    {
      key: 'analytical',
      title: 'Analytical',
      terms: ['system', 'pattern', 'structure', 'because', 'process', 'model', 'framework', 'logic', 'build'],
    },
    {
      key: 'story',
      title: 'Story-led',
      terms: ['story', 'scene', 'character', 'chapter', 'moment', 'arc', 'voice', 'dialogue', 'narrative'],
    },
    {
      key: 'playful',
      title: 'Playful',
      terms: ['funny', 'joke', 'laugh', 'ridiculous', 'wild', 'absurd', 'comedic', 'playful'],
    },
    {
      key: 'driven',
      title: 'Driven',
      terms: ['need', 'want', 'must', 'should', 'move', 'push', 'finish', 'make', 'ship'],
    },
  ].map((bucket) => ({ ...bucket, value: score(bucket.terms) }));

  const ranked = buckets.sort((a, b) => b.value - a.value);
  const primary = ranked[0];
  const secondary = ranked[1];

  const titleMap: Record<string, string> = {
    'reflective:analytical': 'Reflective Architect',
    'reflective:story': 'Meaning Maker',
    'analytical:driven': 'System Builder',
    'story:reflective': 'Story Shaper',
    'story:playful': 'Narrative Spark',
    'playful:analytical': 'Sharp Entertainer',
    'driven:analytical': 'Clear Builder',
    'driven:story': 'Momentum Teller',
  };

  const combinedKey = `${primary?.key ?? ''}:${secondary?.key ?? ''}`;
  const title = titleMap[combinedKey] ?? `${primary?.title ?? 'Creative'} Voice`;
  const voiceCount = entries.filter((entry) => entry.kind === 'voice').length;
  const bookCount = projects.filter((project) => project.type === 'book').length;
  const styleLabel = bookCount > 0 ? 'Long-form leaning' : voiceCount >= Math.max(1, Math.ceil(entries.length * 0.6)) ? 'Voice-first' : 'Mixed capture';
  const signals = extractSignalTerms(entries, drafts);

  return {
    title,
    note: `Built from the themes and language showing up most often across your captures and drafts.`,
    traits: [primary?.title, secondary?.title].filter(Boolean) as string[],
    signals: signals.length ? signals : ['Signal pending'],
    styleLabel,
    isReady: true,
  };
}

type RankedProject = {
  projectId: string;
  name: string;
  score: number;
  contextScore: number;
  label: string;
  entryCount: number;
  extractedCount: number;
  draftCount: number;
  recordedSeconds: number;
  stateSummary: string;
  softDirection: string;
  latestDraftId?: string;
  nextRoute: 'studio' | 'output' | 'project';
};

function getProjectRankings(
  projects: Array<any>,
  entriesById: Record<string, any>,
  draftsById: Record<string, any>,
): RankedProject[] {
  return projects
    .map((project) => {
      const entries = (project.entryIds ?? []).map((id: string) => entriesById[id]).filter(Boolean);
      const drafts = (project.draftIds ?? []).map((id: string) => draftsById[id]).filter(Boolean);
      const extractedCount = entries.filter((entry: any) => entry.status === 'extracted').length;
      const canonCount = project.type === 'book' ? project.book?.canon?.length ?? 0 : 0;
      const outlineCount = project.type === 'book' ? project.book?.outline?.length ?? 0 : 0;
      const recordedSeconds = entries.reduce((sum: number, entry: any) => sum + getEntryRecordedSeconds(entry), 0);
      const lastActivity = Math.max(
        project.createdAt ?? 0,
        ...entries.map((entry: any) => entry.createdAt ?? 0),
        ...drafts.map((draft: any) => draft.createdAt ?? 0),
      );
      const latestDraft = drafts.sort((a: any, b: any) => (b.createdAt ?? 0) - (a.createdAt ?? 0))[0];
      const daysSince = Math.max(0, Math.floor((Date.now() - lastActivity) / (1000 * 60 * 60 * 24)));
      const recencyScore = Math.max(0, 14 - Math.min(daysSince, 14));
      const contextScore = Math.min(100, extractedCount * 20 + drafts.length * 18 + canonCount * 8 + outlineCount * 6 + Math.min(entries.length, 5) * 4 + (project.pinned ? 5 : 0));
      const score = contextScore + recencyScore;
      const label = score >= 78 ? 'Most ready' : score >= 48 ? 'Building strong' : 'Early motion';
      const stateSummary = drafts.length > 0
        ? `${drafts.length} draft${drafts.length === 1 ? '' : 's'}, ${extractedCount} ready entr${extractedCount === 1 ? 'y' : 'ies'}, and ${formatRecordedValue(recordedSeconds)} of recorded material are already in motion.`
        : extractedCount > 0
          ? `${extractedCount} ready entr${extractedCount === 1 ? 'y is' : 'ies are'} holding signal, with ${formatRecordedValue(recordedSeconds)} already captured.`
          : entries.length > 0
            ? `${entries.length} entr${entries.length === 1 ? 'y is' : 'ies are'} inside the project, with ${formatRecordedValue(recordedSeconds)} recorded so far.`
            : 'No entries have landed yet.';
      const softDirection = drafts.length > 0
        ? 'Pick up where you left off and keep shaping the current manuscript.'
        : extractedCount > 0
          ? 'The material is ready whenever you want to start shaping it.'
          : entries.length > 0
            ? 'Feed it a little more, then turn the signal into a real draft.'
            : 'Start the first real entry when the thought is ready.';

      let nextRoute: RankedProject['nextRoute'] = 'project';

      if (latestDraft?.id) {
        nextRoute = 'output';
      } else if (contextScore >= 48) {
        nextRoute = 'studio';
      }

      return {
        projectId: project.id,
        name: project.name,
        score,
        contextScore,
        label,
        entryCount: entries.length,
        extractedCount,
        draftCount: drafts.length,
        recordedSeconds,
        stateSummary,
        softDirection,
        latestDraftId: latestDraft?.id,
        nextRoute,
      };
    })
    .sort((a, b) => b.score - a.score);
}


export function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { state, dispatch } = useAppStore();
  const { width, height } = useWindowDimensions();
  const metrics = getLayoutMetrics(width, height);

  const supabaseConfigured = Boolean(getSupabaseConfig());
  const supabase = getSupabaseClient();
  const signedIn = state.auth.status === 'signedIn';

  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const profile = state.profile.record;
  const accountName = deriveAccountName(profile?.displayName, state.auth.email);
  const hasExplicitDisplayName = isMeaningfulDisplayName(profile?.displayName);
  const [draftDisplayName, setDraftDisplayName] = useState(profile?.displayName ?? '');
  const [draftHandle, setDraftHandle] = useState(profile?.handle ?? '');
  const [outputVisibility, setOutputVisibility] = useState<'private' | 'public'>(profile?.outputVisibility ?? 'private');
  const [workflowFocus, setWorkflowFocus] = useState<'studio' | 'vault' | 'projects' | 'mixed'>(profile?.workflowFocus ?? 'studio');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  useEffect(() => {
    setDraftDisplayName(profile?.displayName ?? '');
    setDraftHandle(profile?.handle ?? '');
    setOutputVisibility(profile?.outputVisibility ?? 'private');
    setWorkflowFocus(profile?.workflowFocus ?? 'studio');
  }, [profile?.displayName, profile?.handle, profile?.outputVisibility, profile?.workflowFocus]);

  useFocusEffect(
    React.useCallback(() => {
      if (!signedIn || !supabaseConfigured || !supabase) return undefined;

      let cancelled = false;

      (async () => {
        const result = await supabaseGetMyProfile();
        if (cancelled || !result.ok) return;
        dispatch({ type: 'profile.set', payload: { record: result.profile } });
      })();

      return () => {
        cancelled = true;
      };
    }, [dispatch, signedIn, supabase, supabaseConfigured]),
  );

  const stats = useMemo(() => {
    const entries = Object.values(state.entries);
    const drafts = Object.values(state.drafts);
    const projects = Object.values(state.projects);
    const captureTimes = entries.map((entry) => entry.createdAt);
    const totalRecordedSeconds = entries.reduce((sum, entry) => sum + getEntryRecordedSeconds(entry), 0);
    const recordedCaptures = entries.filter((entry) => getEntryRecordedSeconds(entry) > 0).length;
    const typedWordCount = entries
      .filter((entry) => entry.kind === 'text')
      .reduce((sum, entry) => sum + countWords(entry.transcript), 0);
    const captureStreakDays = getCaptureStreakDays(captureTimes);
    const joinedAt = profile?.createdAt;
    const recentWeek = getRecentWeekRecordingBars(entries);
    const nextGoalHours = RECORDING_GOALS.find((goal) => totalRecordedSeconds < goal * 3600) ?? 50;
    const previousGoalHours = [...RECORDING_GOALS].reverse().find((goal) => totalRecordedSeconds >= goal * 3600) ?? 0;
    const goalStartSeconds = previousGoalHours * 3600;
    const goalEndSeconds = nextGoalHours * 3600;
    const goalSpan = Math.max(goalEndSeconds - goalStartSeconds, 1);
    const goalProgress = Math.max(0, Math.min(1, (totalRecordedSeconds - goalStartSeconds) / goalSpan));
    const voiceProfile = analyzeVoiceProfile(entries, drafts, projects);
    const totalExtracts = entries.filter((entry) => entry.status === 'extracted').length;
    const rankedProjects = getProjectRankings(projects, state.entries, state.drafts);
    const featuredProject = rankedProjects[0];
    const charmUnlocks = CHARM_MILESTONES.map((charm) => ({
      ...charm,
      unlocked: totalRecordedSeconds >= charm.hours * 3600,
    }));
    const currentCharm = [...charmUnlocks].reverse().find((charm) => charm.unlocked) ?? charmUnlocks[0];
    const nextCharm = charmUnlocks.find((charm) => !charm.unlocked);

    return {
      totalCaptures: entries.length,
      totalExtracts,
      totalDrafts: drafts.length,
      totalProjects: projects.length,
      recordedCaptures,
      typedWordCount,
      totalRecordedSeconds,
      captureStreakDays,
      joinedAt,
      recentWeek,
      nextGoalHours,
      previousGoalHours,
      goalProgress,
      voiceProfile,
      rankedProjects,
      featuredProject,
      charmUnlocks,
      currentCharm,
      nextCharm,
    };
  }, [profile?.createdAt, state.drafts, state.entries, state.projects]);

  const signedInStatItems = [
    { label: 'Captures', value: String(stats.totalCaptures) },
    { label: 'Extracts', value: String(stats.totalExtracts) },
    { label: 'Drafts', value: String(stats.totalDrafts) },
    { label: 'Recorded', value: formatRecordedStatValue(stats.totalRecordedSeconds) },
    { label: 'Words', value: String(stats.typedWordCount) },
    { label: 'Streak', value: String(stats.captureStreakDays) },
  ] as const;

  const signedOutStatItems = [
    { label: 'Captures', value: String(stats.totalCaptures) },
    { label: 'Recorded', value: formatRecordedStatValue(stats.totalRecordedSeconds) },
    { label: 'Words', value: String(stats.typedWordCount) },
    { label: 'Drafts', value: String(stats.totalDrafts) },
    { label: 'Projects', value: String(stats.totalProjects) },
  ] as const;
  const featuredCharm = stats.currentCharm ?? CHARM_MILESTONES[0];

  async function handleSaveProfile() {
    const baseRecord = profile ?? {
      id: state.auth.userId ?? 'local-profile',
      email: state.auth.email,
      displayName: 'Unnamed user',
      createdAt: Date.now(),
    };

    setAuthMessage(null);

    if (signedIn && supabaseConfigured && supabase) {
      const result = await supabaseUpdateMyProfile({
        displayName: draftDisplayName.trim() || 'Unnamed user',
        handle: draftHandle.trim() || undefined,
        testingLabel: baseRecord.testingLabel,
        outputVisibility,
        workflowFocus,
      });

      if (!result.ok) {
        setAuthMessage(result.error);
        return;
      }

      dispatch({
        type: 'profile.set',
        payload: {
          record: {
            ...result.profile,
            outputVisibility,
            workflowFocus,
          },
        },
      });
      setIsEditingProfile(false);
      setAuthMessage('Profile synced across your signed-in devices');
      return;
    }

    dispatch({
      type: 'profile.set',
      payload: {
        record: {
          ...baseRecord,
          displayName: draftDisplayName.trim() || 'Unnamed user',
          handle: draftHandle.trim() || undefined,
          outputVisibility,
          workflowFocus,
        },
      },
    });
    setIsEditingProfile(false);
    setAuthMessage('Profile saved on this device');
  }

  function openFeaturedProject() {
    if (!stats.featuredProject) return;
    navigation.navigate('ProjectDetail', { projectId: stats.featuredProject.projectId });
  }

  return (
    <ScreenLayout title="" headerShown={false} contentPaddingHorizontal={0} contentPaddingTop={0}>
      <ScrollView overScrollMode="never" bounces={false} contentContainerStyle={[styles.scroll, { gap: metrics.stackGap, paddingTop: metrics.headerTopGap, paddingHorizontal: metrics.horizontalFrame, paddingBottom: metrics.stickyBottomSpace }]} showsVerticalScrollIndicator={false}>
        
        <Animated.View style={[styles.topZone, { minHeight: metrics.headerMinHeight }]}> 
          <View style={styles.topRow}>
            <View style={styles.topTextBlock}>
              <Text style={styles.pageTitle}>ACCOUNT</Text>
              <Text style={styles.pageSubtitle}>
                {supabaseConfigured ? (signedIn ? 'SIGNED IN' : 'SIGNED OUT') : 'NOT CONFIGURED'}
              </Text>
            </View>
            {supabaseConfigured && !signedIn ? (
              <AnimatedPressable hitSlop={16} onPress={() => navigation.navigate('Auth')}>
                <Text style={styles.topAction}>SIGN IN</Text>
              </AnimatedPressable>
            ) : null}
          </View>
        </Animated.View>

        <Section title="ACCOUNT">
          {!supabaseConfigured ? (
            <FadeInUp delay={100}>
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>ACCOUNT IS NOT AVAILABLE YET</Text>
                <Text style={styles.emptyCopy}>Sign-in will appear here once account access is ready for this build.</Text>
              </View>
            </FadeInUp>
          ) : signedIn ? (
            <>
              <FadeInUp delay={100}>
                <View style={[styles.card, { paddingHorizontal: 0, borderWidth: 0, backgroundColor: 'transparent' }]}>
                  <GradientText text={accountName} style={[styles.accountName, { textTransform: 'uppercase' }]} colors={['#FF3823', '#000000']} />
                  {hasExplicitDisplayName && state.auth.email ? <Text style={styles.helper}>{state.auth.email.toUpperCase()}</Text> : null}
                  {profile?.handle ? <Text style={styles.helper}>@{profile.handle.toUpperCase()}</Text> : null}
                  {stats.joinedAt ? <Text style={styles.helper}>HERE SINCE {formatShortDate(stats.joinedAt).toUpperCase()}</Text> : null}
                </View>
              </FadeInUp>

              <Section title="PROFILE">
                <FadeInUp delay={125}>
                  {!isEditingProfile ? (
                    <View style={styles.profileSummaryCard}>
                      <View style={styles.profileSummaryHeader}>
                        <View style={styles.profileSummaryCopy}>
                          <Text style={styles.cardTitle}>Account settings</Text>
                          <Text style={styles.cardMeta}>Keep the account details light. Edit only when something actually changes.</Text>
                        </View>
                        <Pressable onPress={() => { setAuthMessage(null); setIsEditingProfile(true); }} style={styles.editProfileButton}>
                          <Text style={styles.editProfileButtonText}>Edit</Text>
                        </Pressable>
                      </View>

                      <View style={styles.profileSummaryGrid}>
                        <View style={styles.profileSummaryItem}>
                          <Text style={styles.fieldLabel}>Display name</Text>
                          <Text style={styles.profileSummaryValue}>{draftDisplayName.trim() || 'Unnamed user'}</Text>
                        </View>
                        <View style={styles.profileSummaryItem}>
                          <Text style={styles.fieldLabel}>Alias</Text>
                          <Text style={styles.profileSummaryValue}>{draftHandle.trim() ? `@${draftHandle.trim()}` : 'Not set'}</Text>
                        </View>
                        <View style={styles.profileSummaryItem}>
                          <Text style={styles.fieldLabel}>Output status</Text>
                          <Text style={styles.profileSummaryValue}>{outputVisibility}</Text>
                        </View>
                        <View style={styles.profileSummaryItem}>
                          <Text style={styles.fieldLabel}>Workflow focus</Text>
                          <Text style={styles.profileSummaryValue}>{workflowFocus}</Text>
                        </View>
                        <View style={styles.profileSummaryItemWide}>
                          <Text style={styles.fieldLabel}>Recorded time</Text>
                          <Text style={styles.profileSummaryValue}>{formatRecordedValue(stats.totalRecordedSeconds)}</Text>
                        </View>
                      </View>
                      {authMessage ? <Text style={styles.helper}>{authMessage}</Text> : null}
                    </View>
                  ) : (
                    <View style={styles.profileControlCard}>
                      <View style={styles.profileSummaryHeader}>
                        <View style={styles.profileSummaryCopy}>
                          <Text style={styles.cardTitle}>Edit profile</Text>
                          <Text style={styles.cardMeta}>Update the account details that should travel with you.</Text>
                        </View>
                        <Pressable
                          onPress={() => {
                            setAuthMessage(null);
                            setDraftDisplayName(profile?.displayName ?? '');
                            setDraftHandle(profile?.handle ?? '');
                            setOutputVisibility(profile?.outputVisibility ?? 'private');
                            setWorkflowFocus(profile?.workflowFocus ?? 'studio');
                            setIsEditingProfile(false);
                          }}
                          style={styles.editProfileButton}
                        >
                          <Text style={styles.editProfileButtonText}>Cancel</Text>
                        </Pressable>
                      </View>

                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Display name</Text>
                        <TextInput
                          value={draftDisplayName}
                          onChangeText={setDraftDisplayName}
                          placeholder="How your account should read"
                          placeholderTextColor={tokens.color.textFaint}
                          style={styles.input}
                        />
                      </View>

                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Alias</Text>
                        <TextInput
                          value={draftHandle}
                          onChangeText={setDraftHandle}
                          placeholder="Short handle"
                          autoCapitalize="none"
                          placeholderTextColor={tokens.color.textFaint}
                          style={styles.input}
                        />
                      </View>

                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Output status</Text>
                        <View style={styles.choiceRow}>
                          {(['private', 'public'] as const).map((value) => (
                            <Pressable
                              key={value}
                              onPress={() => setOutputVisibility(value)}
                              style={[styles.choiceChip, outputVisibility === value ? styles.choiceChipActive : null]}
                            >
                              <Text style={[styles.choiceChipText, outputVisibility === value ? styles.choiceChipTextActive : null]}>{value.toUpperCase()}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>

                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Workflow focus</Text>
                        <View style={styles.choiceRow}>
                          {([
                            { key: 'studio', label: 'Studio' },
                            { key: 'vault', label: 'Vault' },
                            { key: 'projects', label: 'Projects' },
                            { key: 'mixed', label: 'Mixed' },
                          ] as const).map((item) => (
                            <Pressable
                              key={item.key}
                              onPress={() => setWorkflowFocus(item.key)}
                              style={[styles.choiceChip, workflowFocus === item.key ? styles.choiceChipActive : null]}
                            >
                              <Text style={[styles.choiceChipText, workflowFocus === item.key ? styles.choiceChipTextActive : null]}>{item.label.toUpperCase()}</Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>

                      <Button label="Save profile" onPress={() => void handleSaveProfile()} />
                      {authMessage ? <Text style={styles.helper}>{authMessage}</Text> : null}
                    </View>
                  )}
                </FadeInUp>
              </Section>

              {stats.featuredProject ? (
                <Section title="MOST READY PROJECT">
                  <FadeInUp delay={135}>
                    <View style={styles.featuredProjectCard}>
                      <View style={styles.featuredProjectTopRow}>
                        <View style={styles.featuredProjectCopy}>
                          <Text style={styles.featuredProjectEyebrow}>{stats.featuredProject.label.toUpperCase()}</Text>
                          <Text style={styles.featuredProjectTitle}>{stats.featuredProject.name}</Text>
                          <Text style={styles.featuredProjectSummary}>{stats.featuredProject.stateSummary}</Text>
                          <Text style={styles.featuredProjectDirection}>{stats.featuredProject.softDirection}</Text>
                        </View>
                        <View style={styles.featuredProjectScorePill}>
                          <Text style={styles.featuredProjectScoreText}>{Math.round(stats.featuredProject.score)}</Text>
                        </View>
                      </View>

                      <View style={styles.featuredProjectStatsRow}>
                        <View style={styles.featuredProjectStatChip}>
                          <Text style={styles.featuredProjectStatValue}>{formatRecordedStatValue(stats.featuredProject.recordedSeconds)}</Text>
                          <Text style={styles.featuredProjectStatLabel}>Recorded</Text>
                        </View>
                        <View style={styles.featuredProjectStatChip}>
                          <Text style={styles.featuredProjectStatValue}>{stats.featuredProject.extractedCount}</Text>
                          <Text style={styles.featuredProjectStatLabel}>Ready</Text>
                        </View>
                        <View style={styles.featuredProjectStatChip}>
                          <Text style={styles.featuredProjectStatValue}>{stats.featuredProject.draftCount}</Text>
                          <Text style={styles.featuredProjectStatLabel}>Drafts</Text>
                        </View>
                      </View>

                      <Button label="Open project" variant="secondary" onPress={openFeaturedProject} />
                    </View>
                  </FadeInUp>
                </Section>
              ) : null}

              <Section title="PROFILE SIGNAL">
                <FadeInUp delay={150}>
                  <View style={styles.profileSignalCard}>
                    <View style={styles.profileSignalRow}>
                      <View style={styles.profileGlyph}>
                        <View style={styles.profileGlyphCore} />
                        <View style={styles.profileGlyphOrbit} />
                      </View>
                      <View style={styles.profileSignalCopy}>
                        <Text style={[styles.profileSignalTitle, { textTransform: 'uppercase' }]}>{stats.voiceProfile.title}</Text>
                        <Text style={styles.helper}>{stats.voiceProfile.note}</Text>
                      </View>
                    </View>

                    {stats.voiceProfile.isReady ? (
                      <>
                        <View style={styles.traitRow}>
                          {stats.voiceProfile.traits.map((trait) => (
                            <View key={trait} style={styles.traitPill}>
                              <Text style={styles.traitPillText}>{trait.toUpperCase()}</Text>
                            </View>
                          ))}
                        </View>

                        <View style={styles.profileMetaRow}>
                          <View style={styles.profileMiniCard}>
                            <Text style={styles.profileMiniLabel}>CAPTURE STYLE</Text>
                            <Text style={styles.profileMiniValue}>{stats.voiceProfile.styleLabel?.toUpperCase()}</Text>
                          </View>
                          <View style={styles.profileMiniCard}>
                            <Text style={styles.profileMiniLabel}>STRONGEST SIGNAL</Text>
                            <Text style={styles.profileMiniValue}>{stats.voiceProfile.signals[0]?.toUpperCase()}</Text>
                          </View>
                        </View>

                        <View style={styles.traitRow}>
                          {stats.voiceProfile.signals.map((signal) => (
                            <View key={signal} style={styles.signalPill}>
                              <Text style={styles.signalPillText}>{signal.toUpperCase()}</Text>
                            </View>
                          ))}
                        </View>
                      </>
                    ) : null}
                  </View>
                </FadeInUp>
              </Section>

              <Section title="PROGRESS">
                <FadeInUp delay={200}>
                  <View style={styles.goalCard}>
                    <View style={styles.goalHeaderRow}>
                      <View style={styles.goalHeaderCopy}>
                        <Text style={styles.goalEyebrow}>RECORDED TIME</Text>
                        <Text style={styles.goalValue}>
                          {formatRecordedValue(stats.totalRecordedSeconds)} / {formatGoalValue(stats.nextGoalHours)}
                        </Text>
                        <Text style={styles.goalUnit}>TOWARD THE NEXT RECORDING GOAL</Text>
                      </View>
                      <View style={styles.goalPill}>
                        <Text style={styles.goalPillText}>{Math.round(stats.goalProgress * 100)}%</Text>
                      </View>
                    </View>

                    <View style={styles.gaugeTrack}>
                      <View style={[styles.gaugeFill, { width: `${Math.max(stats.goalProgress * 100, stats.totalRecordedSeconds > 0 ? 6 : 0)}%` }]} />
                    </View>

                    <View style={styles.goalAxis}>
                      <Text style={styles.goalAxisLabel}>{formatGoalValue(stats.previousGoalHours)}</Text>
                      <Text style={styles.goalAxisLabel}>{formatGoalValue(stats.nextGoalHours)}</Text>
                    </View>

                    <View style={styles.charmBlock}>
                      <View style={styles.charmHeaderRow}>
                        <Text style={styles.charmTitle}>MILESTONE TRACK</Text>
                        {stats.nextCharm ? <Text style={styles.charmHint}>NEXT MILESTONE {formatMilestoneLabel(stats.nextCharm.hours).toUpperCase()}</Text> : <Text style={styles.charmHint}>ALL UNLOCKED</Text>}
                      </View>

                      <View
                        style={[
                          styles.featuredCharmCard,
                          { backgroundColor: `${featuredCharm.color}12`, borderColor: `${featuredCharm.color}30` },
                        ]}
                      >
                        <View style={styles.featuredCharmLeft}>
                          <View style={[styles.featuredCharmGlyph, { backgroundColor: `${featuredCharm.color}18` }]}>
                            <View style={[styles.featuredCharmRing, { borderColor: `${featuredCharm.color}55` }]} />
                            <View style={[styles.featuredCharmGem, { backgroundColor: featuredCharm.color }]} />
                          </View>
                          <View style={styles.featuredCharmCopy}>
                            <Text style={styles.featuredCharmEyebrow}>CURRENT UNLOCK</Text>
                            <Text style={[styles.featuredCharmName, { textTransform: 'uppercase' }]}>{featuredCharm.name}</Text>
                            <Text style={styles.featuredCharmNote}>{describeCharm(featuredCharm.hours)}{stats.voiceProfile.signals[0] ? ` Strongest signal: ${stats.voiceProfile.signals[0].toUpperCase()}.` : ''}</Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.charmGrid}>
                        {stats.charmUnlocks.map((charm) => (
                          <View
                            key={charm.name}
                            style={[
                              styles.charmCard,
                              charm.unlocked
                                ? { backgroundColor: `${charm.color}15`, borderColor: `${charm.color}40` }
                                : styles.charmCardLocked,
                            ]}
                          >
                            <View style={styles.charmVisualWrap}>
                              <View
                                style={[
                                  styles.charmHalo,
                                  { backgroundColor: charm.unlocked ? `${charm.color}22` : tokens.color.surface2 },
                                ]}
                              />
                              <View
                                style={[
                                  styles.charmGem,
                                  { backgroundColor: charm.unlocked ? charm.color : tokens.color.borderSubtle },
                                ]}
                              />
                              <View
                                style={[
                                  styles.charmSpark,
                                  { backgroundColor: charm.unlocked ? tokens.color.bg : 'transparent' },
                                ]}
                              />
                            </View>

                            <Text style={[styles.charmName, !charm.unlocked ? styles.charmNameLocked : null, { textTransform: 'uppercase' }]}>{maskMilestoneName(charm.name, charm.unlocked)}</Text>
                            <Text style={[styles.charmMeta, { textTransform: 'uppercase' }]}>{formatMilestoneLabel(charm.hours)}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  </View>
                </FadeInUp>

                <FadeInUp delay={250}>
                  <View style={styles.statGrid}>
                    {signedInStatItems.map((item, index) => {
                      const tone = STAT_TONES[index % STAT_TONES.length] ?? STAT_TONES[0];
                      return (
                        <View key={item.label} style={[styles.statCard, { backgroundColor: tokens.color.surface2 }]}>
                          <Text style={[styles.statValue, { color: tone.accentColor }]}>{item.value}</Text>
                          <Text style={[styles.statLabel, { textTransform: 'uppercase' }]}>{item.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                </FadeInUp>
              </Section>

              <Section title="THIS WEEK">
                <FadeInUp delay={300}>
                  <View style={styles.card}>
                    <View style={styles.weekChart}>
                      {stats.recentWeek.map((bar) => (
                        <View key={bar.key} style={styles.weekBarCol}>
                          <View style={styles.weekBarTrack}>
                            <View style={[styles.weekBarFill, { height: `${bar.ratio * 100}%` }]} />
                          </View>
                          <Text style={styles.weekBarLabel}>{bar.label}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={styles.helper}>
                      {stats.totalRecordedSeconds > 0
                        ? `${stats.recordedCaptures} RECORDED CAPTURE${stats.recordedCaptures === 1 ? '' : 'S'} ACROSS ${stats.totalProjects} PROJECT${stats.totalProjects === 1 ? '' : 'S'}.`
                        : 'Your recent recording rhythm will show up here as you go.'}
                    </Text>
                    <Text style={styles.weekInsight}>
                      {stats.totalRecordedSeconds > 0
                        ? 'Use this rhythm as your operating cue: keep feeding the system until a theme repeats, then turn it into structure or a real draft.'
                        : 'Once you start recording, this panel becomes your weekly operating rhythm.'}
                    </Text>
                  </View>
                </FadeInUp>
              </Section>

              <Section title="SESSION">
                <FadeInUp delay={350}>
                  <View style={[styles.card, { gap: tokens.space[16] }]}>
                    <View style={{gap: 4}}>
                      <Text style={styles.value}>YOU ARE SIGNED IN</Text>
                      {state.sync.status === 'syncing' ? <Text style={styles.helper}>SAVING YOUR LATEST CHANGES…</Text> : null}
                      {state.sync.lastError ? <Text style={styles.helper}>WE HIT A SAVING ISSUE. LOCALS RETAINED.</Text> : null}
                    </View>
                    <AnimatedPressable
                      style={styles.actionBtnSec}
                      onPress={() => {
                        setAuthMessage(null);
                        if (!supabase) {
                          setAuthMessage('Account is unavailable right now');
                          return;
                        }
                        supabase.auth
                          .signOut()
                          .then(() => {
                            dispatch({ type: 'auth.clear' });
                          })
                          .catch((e) => setAuthMessage(e?.message || 'Sign out failed'));
                      }}
                    >
                      <Text style={styles.actionBtnTextSec}>SIGN OUT</Text>
                    </AnimatedPressable>
                    {authMessage ? <Text style={styles.helper}>{authMessage}</Text> : null}
                  </View>
                </FadeInUp>
              </Section>

            </>
          ) : (
            <FadeInUp delay={100}>
              <View style={styles.card}>
                <Text style={styles.value}>NO ACCOUNT CONNECTED</Text>
                <Text style={styles.helper}>Create an account or sign in to pick up where you left off.</Text>
                <AnimatedPressable style={styles.actionBtn} onPress={() => navigation.navigate('Auth')}>
                  <Text style={styles.actionBtnText}>CREATE ACCOUNT OR SIGN IN</Text>
                </AnimatedPressable>
                <Section title="PROGRESS SO FAR">
                  <View style={styles.statGrid}>
                    {signedOutStatItems.map((item, index) => {
                      const tone = STAT_TONES[index % STAT_TONES.length] ?? STAT_TONES[0];
                      return (
                        <View key={item.label} style={[styles.statCard, { backgroundColor: tokens.color.surface2 }]}>
                          <Text style={[styles.statValue, { color: tone.accentColor }]}>{item.value}</Text>
                          <Text style={[styles.statLabel, { textTransform: 'uppercase' }]}>{item.label}</Text>
                        </View>
                      );
                    })}
                  </View>
                </Section>
                {authMessage ? <Text style={styles.helper}>{authMessage}</Text> : null}
              </View>
            </FadeInUp>
          )}
        </Section>
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
    color: tokens.color.brand,
    letterSpacing: 1,
  },
  card: {
    padding: tokens.space[16],
    borderRadius: tokens.radius[16],
    gap: tokens.space[8],
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  emptyState: {
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius[16],
    padding: tokens.space[20],
    justifyContent: 'center',
    gap: tokens.space[16],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
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
  cardTitle: {
    fontSize: tokens.font.size[16],
    color: tokens.color.text,
    fontWeight: tokens.font.weight.semibold,
  },
  cardMeta: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
    lineHeight: 18,
  },
  helper: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
    letterSpacing: 0.5,
  },
  profileSignalCard: {
    padding: tokens.space[20],
    borderRadius: tokens.radius[16],
    gap: tokens.space[16],
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  profileControlCard: {
    padding: tokens.space[20],
    borderRadius: tokens.radius[16],
    gap: tokens.space[16],
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  profileSummaryCard: {
    padding: tokens.space[20],
    borderRadius: tokens.radius[16],
    gap: tokens.space[16],
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  profileSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: tokens.space[12],
  },
  profileSummaryCopy: {
    flex: 1,
    gap: tokens.space[4],
  },
  editProfileButton: {
    paddingHorizontal: tokens.space[12],
    paddingVertical: tokens.space[8],
    borderRadius: 999,
    backgroundColor: tokens.color.surface2,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  editProfileButtonText: {
    fontSize: tokens.font.size[10],
    color: tokens.color.text,
    fontWeight: tokens.font.weight.semibold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  profileSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space[12],
  },
  profileSummaryItem: {
    width: '47%',
    padding: tokens.space[12],
    borderRadius: tokens.radius[12],
    backgroundColor: tokens.color.surface2,
    gap: tokens.space[8],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  profileSummaryItemWide: {
    width: '100%',
    padding: tokens.space[12],
    borderRadius: tokens.radius[12],
    backgroundColor: tokens.color.surface2,
    gap: tokens.space[8],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  profileSummaryValue: {
    fontSize: tokens.font.size[14],
    color: tokens.color.text,
    fontWeight: tokens.font.weight.semibold,
    textTransform: 'capitalize',
  },
  fieldGroup: {
    gap: tokens.space[8],
  },
  fieldLabel: {
    fontSize: tokens.font.size[10],
    color: tokens.color.textMuted,
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: tokens.color.border,
    backgroundColor: tokens.color.surface2,
    borderRadius: tokens.radius[12],
    paddingVertical: tokens.space[12],
    paddingHorizontal: tokens.space[12],
    fontSize: tokens.font.size[14],
    color: tokens.color.text,
  },
  choiceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space[8],
  },
  choiceChip: {
    paddingHorizontal: tokens.space[12],
    paddingVertical: tokens.space[8],
    borderRadius: 999,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    backgroundColor: tokens.color.surface2,
  },
  choiceChipActive: {
    borderColor: 'rgba(255, 56, 35, 0.20)',
    backgroundColor: 'rgba(255, 56, 35, 0.10)',
  },
  choiceChipText: {
    fontSize: tokens.font.size[10],
    color: tokens.color.textMuted,
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 1,
  },
  choiceChipTextActive: {
    color: tokens.color.brand,
  },
  featuredProjectCard: {
    padding: tokens.space[20],
    borderRadius: tokens.radius[16],
    gap: tokens.space[16],
    backgroundColor: '#FFF7F3',
    borderWidth: 1,
    borderColor: 'rgba(255, 56, 35, 0.14)',
  },
  featuredProjectTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: tokens.space[12],
  },
  featuredProjectCopy: {
    flex: 1,
    gap: tokens.space[4],
  },
  featuredProjectEyebrow: {
    fontSize: tokens.font.size[10],
    color: tokens.color.brand,
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 1.2,
  },
  featuredProjectTitle: {
    fontSize: tokens.font.size[18],
    color: tokens.color.text,
    fontWeight: tokens.font.weight.bold,
  },
  featuredProjectSummary: {
    fontSize: tokens.font.size[14],
    color: tokens.color.text,
    lineHeight: 20,
  },
  featuredProjectDirection: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
    lineHeight: 18,
  },
  featuredProjectScorePill: {
    minWidth: 54,
    paddingHorizontal: tokens.space[12],
    paddingVertical: tokens.space[8],
    borderRadius: 999,
    backgroundColor: 'rgba(255, 56, 35, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255, 56, 35, 0.20)',
    alignItems: 'center',
  },
  featuredProjectScoreText: {
    fontSize: tokens.font.size[16],
    color: tokens.color.brand,
    fontWeight: tokens.font.weight.bold,
  },
  featuredProjectStatsRow: {
    flexDirection: 'row',
    gap: tokens.space[12],
  },
  featuredProjectStatChip: {
    flex: 1,
    paddingHorizontal: tokens.space[12],
    paddingVertical: tokens.space[12],
    borderRadius: tokens.radius[12],
    backgroundColor: 'rgba(255,255,255,0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255, 56, 35, 0.10)',
    gap: tokens.space[4],
  },
  featuredProjectStatValue: {
    fontSize: tokens.font.size[14],
    color: tokens.color.text,
    fontWeight: tokens.font.weight.semibold,
  },
  featuredProjectStatLabel: {
    fontSize: tokens.font.size[10],
    color: tokens.color.textMuted,
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  recommendationCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: tokens.radius[16],
    borderWidth: 1,
    borderColor: 'rgba(255, 56, 35, 0.16)',
    backgroundColor: '#FFF8F4',
  },
  recommendationGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  recommendationGlow: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 120,
    backgroundColor: 'rgba(255,255,255,0.35)',
    opacity: 0.28,
  },
  recommendationContent: {
    padding: tokens.space[20],
    gap: tokens.space[12],
  },
  recommendationEyebrow: {
    fontSize: tokens.font.size[10],
    color: tokens.color.brand,
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 1.2,
  },
  recommendationTitle: {
    fontSize: tokens.font.size[20],
    lineHeight: 26,
    color: tokens.color.text,
    fontWeight: tokens.font.weight.bold,
  },
  recommendationCopy: {
    fontSize: tokens.font.size[14],
    lineHeight: 20,
    color: tokens.color.textMuted,
  },
  recommendationKeyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space[8],
  },
  recommendationKeyPill: {
    paddingHorizontal: tokens.space[12],
    paddingVertical: tokens.space[8],
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 56, 35, 0.12)',
  },
  recommendationKeyText: {
    fontSize: tokens.font.size[10],
    color: tokens.color.brand,
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 1,
  },
  profileSignalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[16],
  },
  profileGlyph: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: tokens.color.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  profileGlyphCore: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: tokens.color.text,
  },
  profileGlyphOrbit: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: tokens.color.brand,
    opacity: 0.3,
  },
  profileSignalCopy: {
    flex: 1,
    gap: tokens.space[4],
  },
  profileSignalTitle: {
    fontSize: tokens.font.size[16],
    color: tokens.color.text,
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 1,
  },
  traitRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space[8],
  },
  profileMetaRow: {
    flexDirection: 'row',
    gap: tokens.space[12],
  },
  profileMiniCard: {
    flex: 1,
    padding: tokens.space[12],
    borderRadius: tokens.radius[12],
    backgroundColor: tokens.color.surface2,
    gap: tokens.space[4],
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  profileMiniLabel: {
    fontSize: tokens.font.size[10],
    color: tokens.color.textMuted,
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 1,
  },
  profileMiniValue: {
    fontSize: tokens.font.size[12],
    color: tokens.color.text,
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 1,
  },
  traitPill: {
    paddingHorizontal: tokens.space[12],
    paddingVertical: tokens.space[8],
    borderRadius: tokens.radius[12],
    backgroundColor: tokens.color.surface2,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  traitPillText: {
    fontSize: tokens.font.size[10],
    color: tokens.color.text,
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 1,
  },
  signalPill: {
    paddingHorizontal: tokens.space[12],
    paddingVertical: tokens.space[8],
    borderRadius: tokens.radius[12],
    backgroundColor: tokens.color.surface2,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  signalPillText: {
    fontSize: tokens.font.size[10],
    color: tokens.color.text,
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 1,
  },
  label: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 1,
  },
  value: {
    fontSize: tokens.font.size[14],
    color: tokens.color.text,
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 1,
  },
  accountName: {
    fontSize: tokens.font.size[20],
    color: tokens.color.text,
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 1,
  },
  goalCard: {
    padding: tokens.space[20],
    borderRadius: tokens.radius[16],
    gap: tokens.space[16],
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  goalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.space[12],
  },
  goalHeaderCopy: {
    gap: tokens.space[4],
    flexShrink: 1,
  },
  goalEyebrow: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 1,
  },
  goalValue: {
    fontSize: tokens.font.size[20],
    color: tokens.color.text,
    fontWeight: tokens.font.weight.bold,
  },
  goalUnit: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 1,
  },
  goalPill: {
    paddingHorizontal: tokens.space[12],
    paddingVertical: tokens.space[8],
    borderRadius: tokens.radius[12],
    backgroundColor: tokens.color.surface2,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  goalPillText: {
    fontSize: tokens.font.size[12],
    color: tokens.color.text,
    fontWeight: tokens.font.weight.bold,
  },
  gaugeTrack: {
    height: 8,
    borderRadius: tokens.radius[100],
    backgroundColor: tokens.color.surface2,
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    borderRadius: tokens.radius[100],
    backgroundColor: tokens.color.text,
  },
  goalAxis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalAxisLabel: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
    fontWeight: tokens.font.weight.bold,
  },
  charmBlock: {
    gap: tokens.space[12],
    marginTop: tokens.space[8],
  },
  charmHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.space[12],
  },
  featuredCharmCard: {
    borderRadius: tokens.radius[16],
    padding: tokens.space[16],
    backgroundColor: tokens.color.surface,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  featuredCharmLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[12],
  },
  featuredCharmGlyph: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  featuredCharmRing: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  featuredCharmGem: {
    width: 22,
    height: 22,
    borderRadius: 7,
    transform: [{ rotate: '45deg' }],
  },
  featuredCharmCopy: {
    flex: 1,
    gap: tokens.space[4],
  },
  featuredCharmEyebrow: {
    fontSize: tokens.font.size[10],
    color: tokens.color.textMuted,
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 1,
  },
  featuredCharmName: {
    fontSize: tokens.font.size[16],
    color: tokens.color.text,
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 1,
  },
  featuredCharmNote: {
    fontSize: tokens.font.size[12],
    lineHeight: 18,
    color: tokens.color.textMuted,
  },
  charmTitle: {
    fontSize: tokens.font.size[12],
    color: tokens.color.text,
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 1,
  },
  charmHint: {
    fontSize: tokens.font.size[10],
    color: tokens.color.textMuted,
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 1,
  },
  charmGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space[8],
  },
  charmCard: {
    width: '31.5%',
    minWidth: 92,
    borderRadius: tokens.radius[12],
    padding: tokens.space[12],
    alignItems: 'center',
    gap: tokens.space[8],
    borderWidth: 1,
  },
  charmCardLocked: {
    backgroundColor: tokens.color.surface,
    borderColor: tokens.color.borderSubtle,
  },
  charmVisualWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  charmHalo: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  charmGem: {
    width: 18,
    height: 18,
    borderRadius: 6,
    transform: [{ rotate: '45deg' }],
  },
  charmSpark: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    top: 6,
    right: 5,
  },
  charmName: {
    fontSize: tokens.font.size[10],
    color: tokens.color.text,
    fontWeight: tokens.font.weight.bold,
    textAlign: 'center',
    letterSpacing: 1,
  },
  charmNameLocked: {
    color: tokens.color.textFaint,
    letterSpacing: 2,
  },
  charmMeta: {
    fontSize: tokens.font.size[10],
    color: tokens.color.textMuted,
    textAlign: 'center',
    fontWeight: tokens.font.weight.bold,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: tokens.space[12],
    columnGap: tokens.space[12],
  },
  statCard: {
    width: '47.5%',
    padding: tokens.space[16],
    borderRadius: tokens.radius[16],
    gap: tokens.space[8],
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  statValue: {
    fontSize: tokens.font.size[24],
    lineHeight: tokens.font.size[24] * 1.2,
    fontWeight: tokens.font.weight.bold,
    textAlign: 'center',
  },
  statLabel: {
    fontSize: tokens.font.size[10],
    color: tokens.color.textMuted,
    fontWeight: tokens.font.weight.bold,
    textAlign: 'center',
    letterSpacing: 1,
  },
  weekChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: tokens.space[8],
    paddingBottom: tokens.space[8],
  },
  weekBarCol: {
    flex: 1,
    alignItems: 'center',
    gap: tokens.space[8],
  },
  weekBarTrack: {
    width: '100%',
    maxWidth: 28,
    height: 120,
    borderRadius: tokens.radius[100],
    backgroundColor: tokens.color.surface2,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  weekBarFill: {
    width: '100%',
    minHeight: 8,
    backgroundColor: tokens.color.brand,
    borderRadius: tokens.radius[100],
  },
  weekInsight: {
    fontSize: tokens.font.size[12],
    lineHeight: 18,
    color: tokens.color.textMuted,
  },
  weekBarLabel: {
    fontSize: tokens.font.size[10],
    color: tokens.color.textMuted,
    fontWeight: tokens.font.weight.bold,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: tokens.color.text,
    height: 48,
    borderRadius: tokens.radius[16],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: tokens.space[8],
  },
  actionBtnText: {
    color: tokens.color.surface,
    fontSize: tokens.font.size[12],
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 1,
  },
  actionBtnSec: {
    backgroundColor: tokens.color.surface2,
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    height: 48,
    borderRadius: tokens.radius[16],
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnTextSec: {
    color: tokens.color.brand,
    fontSize: tokens.font.size[12],
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 1,
  },
});
