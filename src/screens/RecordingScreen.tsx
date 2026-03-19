import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

import { analyzeLiveSession, extractEntry, type LiveSessionSignal } from '../api/alibiApi';
import type { RootStackParamList } from '../navigation/types';
import { ScribbleMic } from '../components/ScribbleMic';
import { LinearGradient } from 'expo-linear-gradient';
import { ScreenLayout } from '../components/ScreenLayout';
import { Toast } from '../components/Toast';
import { getLayoutMetrics } from '../theme/layout';
import { tokens } from '../theme/tokens';
import { useAppStore } from '../store/store';
import { makeInstantRecordingTitle } from '../utils/entryTitles';
import { estimateVoiceDurationSecFromTranscript } from '../utils/entryDuration';
import { triggerMediumFeedback, triggerSoftFeedback, triggerSuccessFeedback } from '../utils/feedback';
import { makeId } from '../utils/id';
import { readFileAsBase64 } from '../utils/fileAccess';
import { playFeedbackSound } from '../utils/soundFeedback';

type Props = NativeStackScreenProps<RootStackParamList, 'Recording'>;

type DisplayedSignal = LiveSessionSignal & {
  source: 'api' | 'guide';
  createdAt: number;
};

type LiveLane = {
  label: string;
  supportingPhrases: string[];
  stability: number;
};

type InterviewState = {
  coveredDimensions: string[];
  missingDimensions: string[];
  recommendedFocus: string;
};

type QuestionCategory = 'clarifying' | 'expanding' | 'structural';

type ProjectContextFrame = {
  recentTitle?: string;
  themes?: string[];
  highlights?: string[];
  premise?: string;
  outlineSteps?: string[];
  canon?: string[];
  currentDraftTitle?: string;
  latestDraftTitle?: string;
};

type QuestionPlan = {
  category: QuestionCategory;
  goal: string;
  rationale: string;
};

const LIVE_STOP_WORDS = new Set([
  'the', 'and', 'that', 'with', 'from', 'this', 'have', 'your', 'about', 'what', 'when', 'they', 'them', 'into', 'then',
  'just', 'like', 'really', 'because', 'there', 'would', 'could', 'should', 'been', 'were', 'while', 'where', 'which',
  'their', 'more', 'some', 'very', 'over', 'only', 'than', 'also', 'still', 'through', 'thing', 'things', 'make', 'made',
  'want', 'need', 'talk', 'talking', 'said', 'says', 'each', 'much', 'will', 'dont', 'cant', 'youre', 'its', 'im', 'ive',
  'our', 'out', 'for', 'are', 'but', 'not', 'all', 'any', 'too', 'how', 'why', 'who', 'use', 'using', 'used', 'being',
  'here', 'across', 'most', 'often', 'showing', 'show', 'keep', 'keeps', 'gets', 'getting', 'did', 'does', 'done', 'let',
  'lets', 'got', 'going', 'kind', 'sort', 'actually', 'maybe', 'probably', 'little', 'good', 'better', 'best', 'well',
  'right', 'left', 'work', 'works', 'working', 'okay', 'cool', 'yeah', 'bro', 'feel', 'feels', 'stuff', 'something', 'someone',
  'everything', 'anything', 'nothing', 'thought', 'thinking', 'recording', 'alibi', 'start', 'stop', 'voice', 'capture',
]);

function formatTime(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function normalizeLaneText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractLaneTerms(value: string) {
  return normalizeLaneText(value)
    .split(' ')
    .filter((part) => part.length >= 4 && !LIVE_STOP_WORDS.has(part));
}

function titleCaseLane(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function uniqueText(values: Array<string | undefined>, limit: number) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))).slice(0, limit);
}

function rotateQuestionCategory(candidates: QuestionPlan[], recentCategories: QuestionCategory[]) {
  if (!candidates.length) {
    return {
      category: 'expanding' as const,
      goal: 'the next concrete layer that makes the idea more real',
      rationale: 'default to concrete development when no stronger signal appears',
    };
  }

  const last = recentCategories[recentCategories.length - 1];
  const lastTwoSame = recentCategories.length >= 2 && recentCategories.slice(-2).every((item) => item === last);

  if (lastTwoSame && last) {
    return candidates.find((candidate) => candidate.category !== last) ?? candidates[0];
  }

  if (last && candidates[0]?.category === last) {
    return candidates.find((candidate) => candidate.category !== last) ?? candidates[0];
  }

  return candidates[0];
}

function deriveQuestionPlan({
  elapsedSec,
  lane,
  interviewState,
  projectContext,
  recentCategories,
}: {
  elapsedSec: number;
  lane: LiveLane | null;
  interviewState: InterviewState;
  projectContext?: ProjectContextFrame;
  recentCategories: QuestionCategory[];
}): QuestionPlan {
  const missing = new Set(interviewState.missingDimensions);
  const structuralReady = Boolean(projectContext?.outlineSteps?.length || missing.has('Sequence') || missing.has('Turning point') || missing.has('Outcome'));
  const clarifyReady = !lane || lane.stability < 0.52 || missing.has('Motivation') || missing.has('Background') || missing.has('Environment') || missing.has('Conflict');
  const expandReady = Boolean(lane?.label) || Boolean(projectContext?.highlights?.length || projectContext?.themes?.length);

  const clarifyingGoal = missing.has('Motivation')
    ? 'why this matters enough to commit to'
    : missing.has('Background')
      ? 'what earlier experience or belief led to this'
      : missing.has('Environment')
        ? 'what conditions around this idea make it possible or risky'
        : missing.has('Conflict')
          ? 'what resistance, pressure, or doubt stands in the way'
          : 'the exact claim, motive, or intent at the center of the idea';

  const expandingGoal = missing.has('Turning point')
    ? 'the first concrete moment the idea works, shifts, or proves itself'
    : missing.has('Outcome')
      ? 'the reaction or consequence that makes the idea feel bigger'
      : 'a concrete example, reaction, or detail that deepens the current lane';

  const structuralGoal = missing.has('Sequence')
    ? 'where this belongs in the sequence and what comes just before it'
    : missing.has('Turning point')
      ? 'whether this is buildup, a turning point, or the result of one'
      : missing.has('Outcome')
        ? 'what this causes next in the project structure'
        : projectContext?.outlineSteps?.length
          ? 'how this fits into the larger project structure'
          : 'how this idea should be organized so it becomes more coherent';

  const clarifyingPlan: QuestionPlan = {
    category: 'clarifying',
    goal: clarifyingGoal,
    rationale: 'remove ambiguity before widening the idea',
  };
  const expandingPlan: QuestionPlan = {
    category: 'expanding',
    goal: expandingGoal,
    rationale: 'push the current lane into concrete detail',
  };
  const structuralPlan: QuestionPlan = {
    category: 'structural',
    goal: structuralGoal,
    rationale: 'turn material into sequence or framework',
  };

  const candidates = elapsedSec < 50
    ? [clarifyingPlan, expandingPlan, structuralPlan]
    : elapsedSec < 105
      ? [expandingPlan, clarifyingPlan, structuralPlan]
      : [structuralPlan, expandingPlan, clarifyingPlan];

  const filtered = candidates.filter((candidate) => {
    if (candidate.category === 'clarifying') return clarifyReady;
    if (candidate.category === 'expanding') return expandReady;
    return structuralReady;
  });

  return rotateQuestionCategory(filtered.length ? filtered : candidates, recentCategories);
}

function buildProjectForwardQuestion({
  questionPlan,
}: {
  questionPlan: QuestionPlan;
}) {
  if (questionPlan.category === 'clarifying') {
    if (questionPlan.goal.includes('commit')) return 'Why does this matter enough for them to commit to it?';
    if (questionPlan.goal.includes('earlier experience') || questionPlan.goal.includes('belief')) return 'What earlier belief or experience makes this idea feel true to them?';
    if (questionPlan.goal.includes('conditions')) return 'What conditions around this make it possible or risky?';
    if (questionPlan.goal.includes('resistance') || questionPlan.goal.includes('pressure') || questionPlan.goal.includes('doubt')) return 'What resistance makes this harder than it first sounds?';
    return 'What exactly is the claim or intent at the center of this?';
  }

  if (questionPlan.category === 'structural') {
    if (questionPlan.goal.includes('sequence') || questionPlan.goal.includes('before it')) return 'Where does this belong in the sequence, and what happens right before it?';
    if (questionPlan.goal.includes('turning point')) return 'Is this buildup, a turning point, or the consequence of one?';
    if (questionPlan.goal.includes('causes next')) return 'What does this moment trigger next in the project?';
    return 'Is this core structure, supporting buildup, or the turning point of the idea?';
  }

  if (questionPlan.goal.includes('works') || questionPlan.goal.includes('proves')) return 'What is the first concrete moment this actually works in the real world?';
  if (questionPlan.goal.includes('reaction') || questionPlan.goal.includes('consequence')) return 'What reaction or consequence makes this idea feel bigger?';
  return 'What concrete example, reaction, or detail would make this more vivid?';
}

function shouldAcceptProjectQuestion({
  signal,
  questionPlan,
}: {
  signal: LiveSessionSignal;
  questionPlan: QuestionPlan;
}) {
  if (signal.kind !== 'question') return true;

  const category = signal.questionCategory;
  const advancesProjectBy = signal.advancesProjectBy?.trim();
  const text = signal.text.trim().toLowerCase();

  if (!category || !['clarifying', 'expanding', 'structural'].includes(category)) return false;
  if (!advancesProjectBy) return false;
  if (!text.endsWith('?')) return false;
  if (text.length < 18) return false;
  if (/\b(anything else|what do you think|can you say more|tell me more|want to add)\b/.test(text)) return false;
  if (questionPlan.category === 'structural' && category === 'clarifying') return false;

  return true;
}

function deriveInterviewState({
  transcript,
  runningSummary,
  lane,
}: {
  transcript: string;
  runningSummary: string;
  lane: LiveLane | null;
}): InterviewState {
  const text = `${runningSummary} ${transcript}`.toLowerCase();

  const checks = [
    {
      key: 'Motivation',
      matches: /\bwant|wants|wanted|because|driven|drive|motive|reason|goal|dream|need|needs|needed|believe|belief\b/,
      next: 'motivation and why this matters',
    },
    {
      key: 'Background',
      matches: /\bpast|history|background|grew up|origin|came from|before this|childhood|early|started as\b/,
      next: 'background and where this came from',
    },
    {
      key: 'Environment',
      matches: /\bworld|market|setting|environment|place|city|town|industry|system|conditions|era|time period\b/,
      next: 'the environment or conditions around it',
    },
    {
      key: 'Sequence',
      matches: /\bfirst|then|after|before|next|eventually|suddenly|at first|sequence|step|process|timeline\b/,
      next: 'sequence and what happens first',
    },
    {
      key: 'Conflict',
      matches: /\bconflict|problem|resist|resistance|opposition|skeptic|skepticism|risk|doubt|threat|pressure|against\b/,
      next: 'resistance, pressure, or conflict',
    },
    {
      key: 'Turning point',
      matches: /\bturn|turning point|moment it worked|realized|changed|shifted|breakthrough|pivot|suddenly worked\b/,
      next: 'the turning point or first proof it worked',
    },
    {
      key: 'Outcome',
      matches: /\boutcome|result|impact|ended|ending|consequence|what happened after|led to|therefore|so that\b/,
      next: 'outcomes and consequences',
    },
  ] as const;

  const coveredDimensions = checks.filter((item) => item.matches.test(text)).map((item) => item.key);
  const missingChecks = checks.filter((item) => !item.matches.test(text));

  let recommendedFocus: string = missingChecks[0]?.next ?? 'the next deeper layer of the idea';

  if (lane?.stability && lane.stability < 0.42) {
    recommendedFocus = 'the clearest version of the central idea';
  } else if (!coveredDimensions.includes('Motivation')) {
    recommendedFocus = 'motivation and why this matters';
  } else if (!coveredDimensions.includes('Conflict')) {
    recommendedFocus = 'pressure, resistance, or what stands in the way';
  } else if (!coveredDimensions.includes('Turning point')) {
    recommendedFocus = 'the first real turning point';
  }

  return {
    coveredDimensions,
    missingDimensions: missingChecks.map((item) => item.key),
    recommendedFocus,
  };
}

function deriveLiveLane({
  transcript,
  runningSummary,
  recentTakeaways,
  projectContext,
}: {
  transcript: string;
  runningSummary: string;
  recentTakeaways: string[];
  projectContext?: {
    recentTitle?: string;
    themes?: string[];
    highlights?: string[];
  };
}): LiveLane | null {
  const transcriptTerms = extractLaneTerms(transcript);
  const score = new Map<string, number>();

  const add = (term: string, weight: number) => {
    const key = normalizeLaneText(term);
    if (!key || key.length < 4 || LIVE_STOP_WORDS.has(key)) return;
    score.set(key, (score.get(key) ?? 0) + weight);
  };

  transcriptTerms.forEach((term) => add(term, 1));

  for (let index = 0; index < transcriptTerms.length - 1; index += 1) {
    const bigram = `${transcriptTerms[index]} ${transcriptTerms[index + 1]}`;
    add(bigram, 2.4);
  }

  extractLaneTerms(runningSummary).forEach((term) => add(term, 2.2));
  recentTakeaways.forEach((item) => extractLaneTerms(item).forEach((term) => add(term, 1.6)));
  (projectContext?.themes ?? []).forEach((theme) => add(theme, 2.8));
  (projectContext?.highlights ?? []).slice(0, 4).forEach((item) => extractLaneTerms(item).forEach((term) => add(term, 1.2)));
  if (projectContext?.recentTitle) add(projectContext.recentTitle, 1.3);

  const ranked = Array.from(score.entries()).sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  if (!top) return null;

  const total = ranked.slice(0, 5).reduce((sum, [, value]) => sum + value, 0);
  const stability = Math.max(0, Math.min(1, total > 0 ? top[1] / total : 0));
  const supportingPhrases = ranked
    .slice(0, 3)
    .map(([term]) => titleCaseLane(term))
    .filter(Boolean);

  return {
    label: titleCaseLane(top[0]),
    supportingPhrases,
    stability,
  };
}

function buildContextualGuideCue({
  elapsedSec,
  lane,
  latestSignal,
  interviewState,
  questionPlan,
}: {
  elapsedSec: number;
  lane: LiveLane | null;
  latestSignal?: DisplayedSignal | null;
  interviewState: InterviewState;
  questionPlan: QuestionPlan;
}): DisplayedSignal | null {
  if (elapsedSec < 18) return null;

  if (!lane || lane.stability < 0.38) {
    return {
      kind: 'direction',
      text: 'Stay with the strongest thread for a little longer. No need to answer a question yet.',
      confidence: 'medium',
      source: 'guide',
      createdAt: Date.now(),
    };
  }

  if (elapsedSec < 45) {
    return {
      kind: 'theme',
      text: `The main lane sounds like ${lane.label}. Keep naming the ${interviewState.recommendedFocus.toLowerCase()} inside that lane.`,
      confidence: lane.stability > 0.62 ? 'high' : 'medium',
      source: 'guide',
      createdAt: Date.now(),
    };
  }

  if (elapsedSec < 85 && latestSignal?.kind !== 'question') {
    return {
      kind: 'question',
      text: buildProjectForwardQuestion({ questionPlan }),
      confidence: lane.stability > 0.66 ? 'high' : 'medium',
      source: 'guide',
      createdAt: Date.now(),
    };
  }

  return {
    kind: 'takeaway',
    text: `You likely have enough on ${lane.label}. Land the consequence or decision instead of widening the topic.`,
    confidence: 'medium',
    source: 'guide',
    createdAt: Date.now(),
  };
}

function signalLabel(kind: LiveSessionSignal['kind']) {
  switch (kind) {
    case 'theme':
      return 'Main thread';
    case 'question':
      return 'Next angle';
    case 'direction':
      return 'Try this';
    case 'takeaway':
    default:
      return 'What stands out';
  }
}

function wordsIn(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function takeLastWords(text: string, count: number) {
  const parts = text.trim().split(/\s+/).filter(Boolean);
  return parts.slice(-count).join(' ');
}

function matchHandsFreeCommand(text: string) {
  const normalized = text.toLowerCase().replace(/[^a-z\s]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (normalized.includes('alibi stop recording')) return 'stop';
  if (normalized.includes('alibi start recording')) return 'start';
  return null;
}

function isSpeechRequestConflictError(error: unknown) {
  const message = typeof error === 'string'
    ? error
    : typeof (error as any)?.message === 'string'
      ? (error as any).message
      : '';

  return /another request is active|request is active|recognizer busy|already started|audio.*active|busy/i.test(message);
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'string') return error;
  if (typeof (error as any)?.message === 'string') return (error as any).message;
  if (typeof (error as any)?.error === 'string') return (error as any).error;
  return '';
}

function isIgnorableSpeechMessage(error: unknown) {
  const message = getErrorMessage(error).trim().toLowerCase();
  if (!message) return false;

  return /\babort(ed)?\b|cancelled|canceled|no-speech|no speech|interrupted|speech.*ended|recognition.*ended/.test(message);
}

export function RecordingScreen({ navigation, route }: Props) {
  const { state, dispatch } = useAppStore();
  const { width, height } = useWindowDimensions();
  const metrics = getLayoutMetrics(width, height);
  const voice = { enabled: state.settings.ashtonModeEnabled, notes: state.settings.ashtonVoiceNotes };
  const projectId = route.params?.projectId;
  const draftId = route.params?.draftId;
  const isWeb = Platform.OS === 'web';
  const returnTo = route.params?.returnTo ?? (projectId ? 'project' : 'entry');
  const promptLabel = route.params?.promptLabel?.trim();
  const intakeKey = route.params?.intakeKey;
  const recordingTitle = promptLabel ? makeInstantRecordingTitle({ promptLabel }) : undefined;
  const recordingIntent = intakeKey ? `intake:${intakeKey}` : undefined;
  const project = projectId ? state.projects[projectId] : undefined;
  const projectName = projectId ? state.projects[projectId]?.name : undefined;

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [meter01, setMeter01] = useState<number>(0);
  const [displayMeter01, setDisplayMeter01] = useState<number>(0);
  const [liveSignals, setLiveSignals] = useState<DisplayedSignal[]>([]);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [liveSummary, setLiveSummary] = useState('');
  const [liveTakeaways, setLiveTakeaways] = useState<string[]>([]);
  const [isLiveThinking, setIsLiveThinking] = useState(false);
  const [liveSignalError, setLiveSignalError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [displayedSignal, setDisplayedSignal] = useState<DisplayedSignal | null>(null);

  const pulse = useRef(new Animated.Value(0)).current;
  const level = useRef(new Animated.Value(0)).current;
  const signalSwap = useRef(new Animated.Value(1)).current;
  const lastGuideStepRef = useRef(0);
  const transcriptTallyRef = useRef('');
  const lastLiveWordCountRef = useRef(0);
  const lastApiSignalAtRef = useRef(0);
  const lastQuestionAtRef = useRef(0);
  const recentQuestionCategoriesRef = useRef<QuestionCategory[]>([]);
  const speechPermissionGrantedRef = useRef(false);
  const speechRecognitionActiveRef = useRef(false);
  const speechTransitionRef = useRef(false);
  const liveSpeechDisabledRef = useRef(false);
  const speechShouldRunRef = useRef(false);
  const passiveCommandModeRef = useRef(false);
  const commandLockRef = useRef(false);
  const hearingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activityStepRef = useRef(0);
  const [isHearingNow, setIsHearingNow] = useState(false);
  const hasSession = isWeb ? isRecording || isStopping || elapsedSec > 0 : Boolean(recording);

  const projectContext = useMemo(() => {
    if (!project) return undefined;

    const projectDrafts = (project.draftIds ?? [])
      .map((id) => state.drafts[id])
      .filter((draft): draft is NonNullable<typeof state.drafts[string]> => Boolean(draft))
      .sort((a, b) => b.createdAt - a.createdAt);

    const extractedEntries = (project.entryIds ?? [])
      .map((id) => state.entries[id])
      .filter((entry): entry is NonNullable<typeof state.entries[string]> => Boolean(entry && entry.status === 'extracted'))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 4);

    const themes = Array.from(
      new Set(extractedEntries.flatMap((entry) => (entry.themes ?? []).map((theme) => theme.trim()).filter(Boolean))),
    ).slice(0, 5);

    const highlights = extractedEntries.flatMap((entry) => (entry.highlights ?? []).map((item) => item.trim()).filter(Boolean)).slice(0, 4);

    const premise = project.book?.brief?.premise?.trim();
    const outlineSteps = uniqueText(project.book?.outline.map((item) => item.note?.trim() ? `${item.title}: ${item.note.trim()}` : item.title) ?? [], 4);
    const canon = uniqueText(project.book?.canon.map((item) => `${item.kind}: ${item.title}`) ?? [], 5);
    const currentDraftTitle = draftId ? state.drafts[draftId]?.title?.trim() : undefined;
    const latestDraftTitle = projectDrafts[0]?.title?.trim();

    if (!themes.length && !highlights.length && !premise && !outlineSteps.length && !canon.length && !currentDraftTitle && !latestDraftTitle) return undefined;

    return {
      themes,
      highlights,
      recentTitle: extractedEntries[0]?.title,
      premise,
      outlineSteps,
      canon,
      currentDraftTitle,
      latestDraftTitle,
    };
  }, [draftId, project, state.drafts, state.entries]);

  useEffect(() => {
    if (state.auth.status === 'signedOut') {
      navigation.replace('Auth');
    }
  }, [navigation, state.auth.status]);

  function markHeard(baseLevel = 0.42) {
    activityStepRef.current = (activityStepRef.current + 1) % 4;
    const offsets = [0.1, 0.2, 0.14, 0.24];
    const nextOffset = offsets[activityStepRef.current] ?? 0.1;
    const nextLevel = Math.min(1, baseLevel + nextOffset);

    setMeter01((current) => Math.max(current * 0.55, nextLevel));
    setIsHearingNow(true);

    if (hearingTimeoutRef.current) clearTimeout(hearingTimeoutRef.current);
    hearingTimeoutRef.current = setTimeout(() => setIsHearingNow(false), 1300);
  }

  async function requestSpeechPermissionIfNeeded() {
    if (speechPermissionGrantedRef.current) return true;

    const recognitionPermission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    speechPermissionGrantedRef.current = Boolean(recognitionPermission.granted);
    return speechPermissionGrantedRef.current;
  }

  async function stopSpeechRecognitionSession() {
    if (!speechRecognitionActiveRef.current && !speechTransitionRef.current) return;

    speechTransitionRef.current = true;
    try {
      await Promise.resolve(ExpoSpeechRecognitionModule.stop());
    } catch {
      // ignore stop failures while resetting the session
    } finally {
      speechRecognitionActiveRef.current = false;
      speechTransitionRef.current = false;
    }
  }

  async function startSpeechRecognitionSession(options?: { allowBusyFailure?: boolean; disableLiveOnFailure?: boolean }) {
    if (speechTransitionRef.current || speechRecognitionActiveRef.current) return true;

    speechTransitionRef.current = true;
    try {
      await Promise.resolve(
        ExpoSpeechRecognitionModule.start({
          lang: 'en-US',
          interimResults: true,
          continuous: true,
          addsPunctuation: true,
          requiresOnDeviceRecognition: Platform.OS === 'ios',
          volumeChangeEventOptions: {
            enabled: true,
            intervalMillis: 180,
          },
        }),
      );
      speechRecognitionActiveRef.current = true;
      return true;
    } catch (e: any) {
      speechRecognitionActiveRef.current = false;

      if (options?.disableLiveOnFailure) {
        liveSpeechDisabledRef.current = true;
        speechShouldRunRef.current = false;
      }

      if (options?.allowBusyFailure && isSpeechRequestConflictError(e)) {
        return false;
      }

      throw e;
    } finally {
      speechTransitionRef.current = false;
    }
  }

  function beginHandsFreeListening() {
    if (!isReady || isStarting || isStopping || hasSession) return;
    if (speechTransitionRef.current || speechRecognitionActiveRef.current) return;
    passiveCommandModeRef.current = true;
    requestSpeechPermissionIfNeeded()
      .then((granted) => {
        if (!granted) throw new Error('Speech recognition permission is required.');
        return startSpeechRecognitionSession({ allowBusyFailure: true });
      })
      .catch((e: any) => {
        if (isSpeechRequestConflictError(e)) return;
        setLiveSignalError(e?.message || 'Listening could not start.');
      });
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setError(null);
        if (isWeb) {
          if (cancelled) return;
          setIsReady(true);
          return;
        }

        const perm = await Audio.requestPermissionsAsync();
        if (!perm.granted) {
          setError('Microphone permission is required to record.');
          return;
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        if (cancelled) return;
        setIsReady(true);
      } catch (e: any) {
        setError(e?.message || 'Recording failed to start');
      }
    })();

    return () => {
      cancelled = true;
      speechShouldRunRef.current = false;
      passiveCommandModeRef.current = false;
      liveSpeechDisabledRef.current = false;
      if (hearingTimeoutRef.current) clearTimeout(hearingTimeoutRef.current);
      void stopSpeechRecognitionSession();
      if (recordingRef.current) recordingRef.current.stopAndUnloadAsync().catch(() => {});
    };
    // Don't add `recording` as a dependency; we only want mount/unmount behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWeb]);

  useEffect(() => {
    speechShouldRunRef.current = isRecording && !isStopping;

    if (!isRecording) {
      setIsHearingNow(false);
      if (hearingTimeoutRef.current) {
        clearTimeout(hearingTimeoutRef.current);
        hearingTimeoutRef.current = null;
      }
    }
  }, [isRecording, isStopping]);

  useEffect(() => {
    if (!isReady || isStarting || isStopping) return;
    if (hasSession) {
      passiveCommandModeRef.current = false;
      return;
    }

    beginHandsFreeListening();
  }, [hasSession, isReady, isStarting, isStopping]);

  useEffect(() => {
    if (!isWeb || !isRecording) return;

    const id = setInterval(() => {
      setElapsedSec((current) => current + 1);
    }, 1000);

    return () => clearInterval(id);
  }, [isRecording, isWeb]);

  useEffect(() => {
    if (!isRecording) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [isRecording, pulse]);

  useEffect(() => {
    Animated.timing(level, {
      toValue: displayMeter01,
      duration: 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [displayMeter01, level]);

  useEffect(() => {
    if (!isRecording) {
      setMeter01(0);
      return;
    }

    const id = setInterval(() => {
      setMeter01((current) => {
        if (current <= 0.02) return 0;
        return Math.max(0, current * 0.82 - 0.01);
      });
    }, 70);

    return () => clearInterval(id);
  }, [isRecording]);

  useEffect(() => {
    const id = setInterval(() => {
      setDisplayMeter01((current) => {
        const floor = isRecording ? (wordsIn(liveTranscript) > 0 ? 0.1 : 0.05) : 0;
        const target = isRecording ? Math.max(meter01, floor) : 0;
        const easing = target > current ? 0.38 : isRecording ? 0.14 : 0.2;
        const next = current + (target - current) * easing;
        return Math.abs(next - target) < 0.008 ? target : next;
      });
    }, 50);

    return () => clearInterval(id);
  }, [isRecording, liveTranscript, meter01]);

  const status = useMemo(() => {
    if (error) return 'Mic error';
    if (isStopping) return 'Analyzing…';
    if (!isReady) return 'Starting…';
    if (isStarting) return 'Starting…';
    if (!hasSession) return 'Ready';
    return isRecording ? 'Recording' : 'Paused';
  }, [error, hasSession, isReady, isRecording, isStarting, isStopping]);

  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.4],
  });

  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0],
  });

  const coreScale = level.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.08],
  });

  const visualSize = Math.min(metrics.contentWidth * 0.68, metrics.immersiveHeroHeight * 0.55);
  const latestLiveSignal = liveSignals[0];
  const liveLane = useMemo(
    () =>
      deriveLiveLane({
        transcript: liveTranscript,
        runningSummary: liveSummary,
        recentTakeaways: liveTakeaways,
        projectContext,
      }),
    [liveSummary, liveTakeaways, liveTranscript, projectContext],
  );
  const interviewState = useMemo(
    () => deriveInterviewState({ transcript: liveTranscript, runningSummary: liveSummary, lane: liveLane }),
    [liveLane, liveSummary, liveTranscript],
  );
  const questionPlan = useMemo(
    () => deriveQuestionPlan({ elapsedSec, lane: liveLane, interviewState, projectContext, recentCategories: recentQuestionCategoriesRef.current }),
    [elapsedSec, interviewState, liveLane, projectContext],
  );
  const hasMicSignal = isRecording && (isHearingNow || displayMeter01 > 0.14);
  const micStatusText = !hasSession
    ? 'Mic standing by'
    : isRecording
      ? hasMicSignal
        ? 'Voice is coming through'
        : 'Listening for signal'
      : 'Session paused';

  const livePanelMeta = isLiveThinking ? 'Working' : liveLane?.stability && liveLane.stability >= 0.58 ? 'Theme locked' : interviewState.coveredDimensions.length ? 'Building interview map' : latestLiveSignal ? 'Fresh cue' : isRecording ? 'Listening' : 'Standby';

  const topStatus = !hasSession ? 'Voice capture' : isRecording ? 'Session live' : 'Session paused';

  const hint = useMemo(() => {
    if (!hasSession) return 'Begin when the thought is there.';
    if (isStopping) return 'Wrapping the pass and pulling the readback together.';
    if (isRecording) {
      if (elapsedSec >= 30) return 'Stay with the turn. Stop when the thought has actually landed.';
      if (elapsedSec >= 15) return 'You are in it now. Keep going until the point feels sharp.';
      return 'Talk it through naturally.';
    }
    return 'Pick it back up, or stop and let it resolve.';
  }, [elapsedSec, hasSession, isRecording, isStopping]);

  const sessionTitle = promptLabel ? 'Voice answer' : projectName ? `Recording into ${projectName}` : 'Open capture';
  const sessionSubtitle = promptLabel
    ? promptLabel
    : projectName
      ? 'This folds straight into the project while you talk.'
      : 'Catch the thought now. Shape it later.';
  const captureContextTitle = draftId
    ? `For ${state.drafts[draftId]?.title ?? 'this draft'}`
    : projectName
      ? `For ${projectName}`
      : undefined;
  const captureContextNote = draftId
    ? projectName
      ? `This note comes back to the draft room and stays inside ${projectName}.`
      : 'This note comes back to the draft room when you finish.'
    : projectName
      ? 'This capture will feed the whole project, not just one draft.'
      : undefined;
  const handsFreeHint = !hasSession
    ? 'Hands-free ready: say “Alibi start recording.”'
    : 'Hands-free ready: say “Alibi stop recording.”';
  const captureState: 'idle' | 'listening' | 'recording' | 'processing' = isStopping
    ? 'processing'
    : hasSession
      ? isRecording
        ? 'recording'
        : 'listening'
      : 'idle';
  const captureStateLabel = captureState.charAt(0).toUpperCase() + captureState.slice(1);
  const contextLabel = promptLabel ? 'VOICE ANSWER' : projectName ? 'PROJECT CAPTURE' : 'VOICE CAPTURE';
  const focalMessage = captureState === 'processing'
    ? 'Pulling the capture into shape.'
    : captureState === 'recording'
      ? displayedSignal?.text || 'Stay with the thought until it lands.'
      : captureState === 'listening'
        ? 'Paused and ready when you want to continue.'
        : 'Tap the mic when the thought is ready.';
  const footerCue = captureState === 'processing'
    ? 'Processing your capture.'
    : displayedSignal?.text || liveSummary;

  useSpeechRecognitionEvent('start', () => {
    speechRecognitionActiveRef.current = true;
    setLiveSignalError(null);
    markHeard(0.28);
  });

  useSpeechRecognitionEvent('audiostart', () => {
    markHeard(0.18);
  });

  useSpeechRecognitionEvent('soundstart', () => {
    markHeard(0.32);
  });

  useSpeechRecognitionEvent('speechstart', () => {
    markHeard(0.48);
  });

  useSpeechRecognitionEvent('audioend', () => {
    speechRecognitionActiveRef.current = false;
    if (!isRecording) setMeter01(0);
  });

  useSpeechRecognitionEvent('end', () => {
    speechRecognitionActiveRef.current = false;
    if (!speechShouldRunRef.current && !passiveCommandModeRef.current) return;
    if (speechTransitionRef.current) return;
    if (liveSpeechDisabledRef.current && isRecording) return;

    setLiveSignalError(null);
    void startSpeechRecognitionSession({ allowBusyFailure: true, disableLiveOnFailure: isRecording })
      .catch((e: any) => setLiveSignalError(e?.message || 'Listening stopped unexpectedly.'));
  });

  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results[0]?.transcript?.trim() ?? '';
    if (!transcript) return;

    const command = matchHandsFreeCommand(transcript);
    if (command === 'start' && passiveCommandModeRef.current && !commandLockRef.current) {
      commandLockRef.current = true;
      passiveCommandModeRef.current = false;
      void stopSpeechRecognitionSession();
      triggerSoftFeedback();
      setToastMessage('Hands-free start heard. Recording now.');
      setTimeout(() => {
        void startRecording().finally(() => {
          commandLockRef.current = false;
        });
      }, 120);
      return;
    }

    if (command === 'stop' && isRecording && !commandLockRef.current) {
      commandLockRef.current = true;
      triggerMediumFeedback();
      setToastMessage('Hands-free stop heard. Wrapping the capture.');
      void stopRecording().finally(() => {
        commandLockRef.current = false;
      });
      return;
    }

    if (passiveCommandModeRef.current) return;

    markHeard(event.isFinal ? 0.7 : 0.54);

    if (event.isFinal) {
      transcriptTallyRef.current = `${transcriptTallyRef.current} ${transcript}`.trim();
      setLiveTranscript(transcriptTallyRef.current);
      return;
    }

    setLiveTranscript(`${transcriptTallyRef.current} ${transcript}`.trim());
  });

  useSpeechRecognitionEvent('error', (event) => {
    speechRecognitionActiveRef.current = false;
    const message = event.message || event.error;
    if (isIgnorableSpeechMessage(message)) {
      setLiveSignalError(null);
      return;
    }
    setLiveSignalError(message);
  });

  useSpeechRecognitionEvent('volumechange', (event) => {
    if (!isRecording) return;
    const value = typeof event.value === 'number' ? event.value : -2;
    const normalized = Math.max(0, Math.min(1, (value + 2) / 12));
    if (normalized > 0.02) {
      markHeard(Math.max(0.2, normalized));
    }
  });

  useEffect(() => {
    if (!error) return;
    if (isIgnorableSpeechMessage(error)) {
      setError(null);
      return;
    }
    setToastMessage(error);
    setError(null);
  }, [error]);

  useEffect(() => {
    if (!liveSignalError) return;
    if (isIgnorableSpeechMessage(liveSignalError)) {
      setLiveSignalError(null);
      return;
    }
    setToastMessage(liveSignalError);
    setLiveSignalError(null);
  }, [liveSignalError]);

  function pushSignal(signal: DisplayedSignal) {
    setLiveSignals((current) => {
      const next = [signal, ...current.filter((item) => item.text !== signal.text)];
      return next.slice(0, 3);
    });
  }

  useEffect(() => {
    if (!latestLiveSignal) {
      setDisplayedSignal(null);
      signalSwap.setValue(1);
      return;
    }

    if (!displayedSignal) {
      setDisplayedSignal(latestLiveSignal);
      signalSwap.setValue(1);
      return;
    }

    if (displayedSignal.text === latestLiveSignal.text && displayedSignal.kind === latestLiveSignal.kind) return;

    Animated.sequence([
      Animated.timing(signalSwap, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(signalSwap, { toValue: 0, duration: 1, useNativeDriver: true }),
    ]).start(() => {
      setDisplayedSignal(latestLiveSignal);
      Animated.timing(signalSwap, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  }, [displayedSignal, latestLiveSignal, signalSwap]);

  useEffect(() => {
    if ((!recording && !isWeb) || !isRecording) return;

    const nextStep = elapsedSec >= 90 ? 3 : elapsedSec >= 45 ? 2 : elapsedSec >= 20 ? 1 : 0;
    if (!nextStep || nextStep <= lastGuideStepRef.current) return;

    if (wordsIn(liveTranscript) >= 18 && liveLane?.stability && liveLane.stability >= 0.42) return;
    if (latestLiveSignal?.source === 'api') return;

    lastGuideStepRef.current = nextStep;
    const cue = buildContextualGuideCue({ elapsedSec, lane: liveLane, latestSignal: latestLiveSignal, interviewState, questionPlan });
    if (!cue) return;
    if (cue.kind === 'question') {
      recentQuestionCategoriesRef.current = [...recentQuestionCategoriesRef.current, questionPlan.category].slice(-4);
    }
    pushSignal(cue);
  }, [elapsedSec, interviewState, isRecording, isWeb, latestLiveSignal, liveLane, liveTranscript, questionPlan, recording]);

  useEffect(() => {
    if ((!recording && !isWeb) || !isRecording) return;

    const wordCount = wordsIn(liveTranscript);
    const stability = liveLane?.stability ?? 0;
    const enoughContext = wordCount >= (stability >= 0.62 ? 26 : 38);
    if (!enoughContext) return;
    const requiredDelta = stability >= 0.66 ? 22 : 34;
    if (wordCount - lastLiveWordCountRef.current < requiredDelta) return;
    if (Date.now() - lastApiSignalAtRef.current < 12000) return;
    if (stability < 0.36 && wordCount < 56) return;
    if (latestLiveSignal?.kind === 'question' && Date.now() - lastQuestionAtRef.current < 18000) return;

    lastLiveWordCountRef.current = wordCount;
    setIsLiveThinking(true);
    setLiveSignalError(null);

    const questioningMode = stability < 0.4 ? 'listen' : questionPlan.category === 'clarifying' ? 'clarify' : questionPlan.category === 'structural' && elapsedSec >= 80 ? 'land' : 'probe';
    const laneObjective = liveLane?.label
      ? `Stay inside the user's dominant lane: ${liveLane.label}. Ask a follow-up only if it clearly deepens that same lane.`
      : 'Listen for the emerging theme and avoid premature questioning.';

    analyzeLiveSession(
      {
        recentTranscript: takeLastWords(liveTranscript, 140),
        runningSummary: liveSummary,
        recentTakeaways: liveTakeaways,
        priorSignals: liveSignals.map((item) => ({ kind: item.kind, text: item.text })),
        objective: `${laneObjective} Every question must move the project forward by clarifying intent, expanding concrete detail, or strengthening structure. Prefer coherence over novelty. Help the user become more articulate by drawing out one deeper layer at a time. If the theme is still forming, reflect briefly and keep listening.`,
        mode: project?.type === 'book' ? 'book' : projectId ? 'project' : 'free-think',
        questioningMode,
        detectedLane: liveLane ? { label: liveLane.label, supportingPhrases: liveLane.supportingPhrases, stability: liveLane.stability } : undefined,
        interviewState,
        projectContext,
        questionPlan,
      },
      { baseUrl: state.settings.apiBaseUrlOverride },
    )
      .then((result) => {
        if (!result.ok) {
          setLiveSignalError(result.error);
          return;
        }

        setLiveSummary(result.summary);
        setLiveTakeaways(result.takeaways);
        lastApiSignalAtRef.current = Date.now();
        if (result.signal.kind === 'question') {
          lastQuestionAtRef.current = Date.now();
          const acceptedCategory = result.signal.questionCategory ?? questionPlan.category;
          recentQuestionCategoriesRef.current = [...recentQuestionCategoriesRef.current, acceptedCategory].slice(-4);
        }

        if (questioningMode === 'listen' && result.signal.kind === 'question') {
          const cue = buildContextualGuideCue({ elapsedSec, lane: liveLane, latestSignal: latestLiveSignal, interviewState, questionPlan });
          if (cue) pushSignal(cue);
          return;
        }

        if (!shouldAcceptProjectQuestion({ signal: result.signal, questionPlan })) {
          recentQuestionCategoriesRef.current = [...recentQuestionCategoriesRef.current, questionPlan.category].slice(-4);
          pushSignal({
            kind: 'question',
            text: buildProjectForwardQuestion({ questionPlan }),
            confidence: 'medium',
            questionCategory: questionPlan.category,
            advancesProjectBy: questionPlan.goal,
            source: 'guide',
            createdAt: Date.now(),
          });
          return;
        }

        pushSignal({ ...result.signal, source: 'api', createdAt: Date.now() });
      })
      .catch((e: any) => setLiveSignalError(e?.message || 'Live cue failed'))
      .finally(() => setIsLiveThinking(false));
  }, [elapsedSec, interviewState, isRecording, isWeb, latestLiveSignal, liveLane, liveSignals, liveSummary, liveTakeaways, liveTranscript, project?.type, projectContext, projectId, questionPlan, recording, state.settings.apiBaseUrlOverride]);

  async function startRecording() {
    if (!isReady || recording || isStarting || isStopping) return;
    passiveCommandModeRef.current = false;
    liveSpeechDisabledRef.current = false;
    setError(null);
    setIsStarting(true);
    setElapsedSec(0);
    setMeter01(0);
    setLiveSignals([]);
    setLiveTranscript('');
    setLiveSummary('');
    setLiveTakeaways([]);
    setLiveSignalError(null);
    setDisplayedSignal(null);
    lastGuideStepRef.current = 0;
    lastLiveWordCountRef.current = 0;
    lastApiSignalAtRef.current = 0;
    lastQuestionAtRef.current = 0;
    recentQuestionCategoriesRef.current = [];
    transcriptTallyRef.current = '';
    try {
      await stopSpeechRecognitionSession();

      const recognitionGranted = await requestSpeechPermissionIfNeeded();
      if (!recognitionGranted) {
        throw new Error('Speech recognition permission is required.');
      }

      speechShouldRunRef.current = true;

      if (isWeb) {
        await startSpeechRecognitionSession();
        setIsRecording(true);
        triggerMediumFeedback();
        setToastMessage('Recording live.');
        void playFeedbackSound('record-start');
        return;
      }

      const options = {
        ...(Audio.RecordingOptionsPresets.HIGH_QUALITY as any),
        isMeteringEnabled: true,
      } as any;

      const { recording: rec } = await Audio.Recording.createAsync(
        options,
        (s: any) => {
          const durMs = typeof s?.durationMillis === 'number' ? s.durationMillis : 0;
          setElapsedSec(Math.floor(durMs / 1000));

          const db = typeof s?.metering === 'number' ? s.metering : null;
          if (typeof db === 'number') {
            const v = Math.max(0, Math.min(1, (db + 60) / 60));
            setMeter01(v);
          }
        },
        250,
      );

      setRecording(rec);
      recordingRef.current = rec;

      const liveSpeechStarted = await startSpeechRecognitionSession({ allowBusyFailure: true, disableLiveOnFailure: true });

      setIsRecording(true);
      triggerMediumFeedback();
      setToastMessage(liveSpeechStarted ? 'Recording live.' : 'Recording live. Live cues are temporarily unavailable on this device.');
      void playFeedbackSound('record-start');
    } catch (e: any) {
      speechShouldRunRef.current = false;
      setError(e?.message || 'Recording failed to start');
    } finally {
      setIsStarting(false);
    }
  }

  async function togglePause() {
    if ((!recording && !isWeb) || isStarting || isStopping) return;
    setError(null);
    try {
      if (isRecording) {
        speechShouldRunRef.current = false;
        await stopSpeechRecognitionSession();
        if (recording) await recording.pauseAsync();
        setIsRecording(false);
        triggerSoftFeedback();
      } else {
        if (recording) await recording.startAsync();
        if (!liveSpeechDisabledRef.current) {
          speechShouldRunRef.current = true;
          const restarted = await startSpeechRecognitionSession({ allowBusyFailure: true, disableLiveOnFailure: true });
          if (!restarted) {
            setToastMessage('Recording resumed. Live cues are temporarily unavailable on this device.');
          }
        } else {
          speechShouldRunRef.current = false;
        }
        setIsRecording(true);
        triggerSoftFeedback();
      }
    } catch (e: any) {
      speechShouldRunRef.current = isRecording;
      setError(e?.message || 'Failed to toggle recording');
    }
  }

  async function stopRecording() {
    if ((!recording && !isWeb) || isStarting || isStopping) return;
    passiveCommandModeRef.current = false;
    setError(null);
    setIsStopping(true);
    try {
      speechShouldRunRef.current = false;
      await stopSpeechRecognitionSession();
      const recognizedTranscript = liveTranscript.trim();
      const durationSec = Math.max(elapsedSec, estimateVoiceDurationSecFromTranscript(recognizedTranscript));
      setIsRecording(false);
      triggerMediumFeedback();

      const celebrateCapture = () => {
        triggerSuccessFeedback();
        void playFeedbackSound('success');
      };

      if (isWeb) {
        if (!recognizedTranscript) {
          setError('Nothing was heard. Check the browser microphone permission and try again.');
          setElapsedSec(0);
          return;
        }

        const entryId = makeId('entry');
        const workingTitle = recordingTitle ?? makeInstantRecordingTitle();

        dispatch({
          type: 'entry.createText',
          payload: {
            entryId,
            title: workingTitle,
            text: recognizedTranscript,
            intent: recordingIntent,
            intakeKey,
            kind: 'voice',
            durationSec,
          },
        });

        if (projectId) {
          dispatch({ type: 'project.addEntry', payload: { projectId, entryId } });
          dispatch({ type: 'entry.setStatus', payload: { entryId, status: 'processing' } });
        }

        const result = await extractEntry(
          {
            title: workingTitle,
            transcript: recognizedTranscript,
            intent: recordingIntent,
            voice,
          },
          { baseUrl: state.settings.apiBaseUrlOverride },
        );

        if (result.ok) {
          dispatch({
            type: 'entry.setExtraction',
            payload: {
              entryId,
              title: result.title,
              transcript: result.transcript,
              highlights: result.highlights,
              themes: result.themes,
              ideas: result.ideas,
            },
          });
          celebrateCapture();
        } else {
          dispatch({ type: 'entry.setStatus', payload: { entryId, status: 'captured' } });
          navigation.replace('EntryDetail', { entryId, autoExtract: true });
          return;
        }

        if (projectId && returnTo === 'studio') {
          navigation.replace('Studio', { projectId });
          return;
        }
        if (projectId && returnTo === 'project') {
          navigation.replace('ProjectDetail', { projectId });
          return;
        }
        if (returnTo === 'output' && draftId) {
          navigation.replace('Output', { draftId });
          return;
        }

        navigation.replace('EntryDetail', { entryId, autoExtract: true });
        return;
      }

      const nativeRecording = recording;
      if (!nativeRecording) {
        setError('Recording session missing');
        return;
      }

      await nativeRecording.stopAndUnloadAsync();
      const uri = nativeRecording.getURI();
      setRecording(null);
      recordingRef.current = null;

      if (!uri) {
        setError('Recording file missing');
        return;
      }

      const mime = guessAudioMimeType(uri);
      const entryId = makeId('entry');
      const workingTitle = recordingTitle ?? makeInstantRecordingTitle();

      dispatch({
        type: 'entry.createRecording',
        payload: {
          entryId,
          title: workingTitle,
          intent: recordingIntent,
          intakeKey,
          durationSec,
          audioUri: uri,
          audioMimeType: mime,
        },
      });

      if (projectId) {
        dispatch({ type: 'project.addEntry', payload: { projectId, entryId } });
      }

      if (projectId) {
        dispatch({ type: 'entry.setStatus', payload: { entryId, status: 'processing' } });
        try {
          const base64 = await readFileAsBase64(uri);
          if (base64.length > 6_000_000) {
            throw new Error('Recording is too long for immediate digest right now.');
          }

          const result = await extractEntry(
            {
              title: workingTitle,
              transcript: recognizedTranscript,
              intent: recordingIntent,
              voice,
              audio: {
                base64,
                mimeType: mime,
                filename: 'audio',
              },
            },
            { baseUrl: state.settings.apiBaseUrlOverride },
          );

          if (result.ok) {
            dispatch({
              type: 'entry.setExtraction',
              payload: {
                entryId,
                title: result.title,
                transcript: result.transcript,
                highlights: result.highlights,
                themes: result.themes,
                ideas: result.ideas,
              },
            });
            celebrateCapture();
          } else {
            dispatch({ type: 'entry.setStatus', payload: { entryId, status: 'captured' } });
            navigation.replace('EntryDetail', { entryId, autoExtract: true });
            return;
          }
        } catch {
          dispatch({ type: 'entry.setStatus', payload: { entryId, status: 'captured' } });
          navigation.replace('EntryDetail', { entryId, autoExtract: true });
          return;
        }

        if (returnTo === 'studio') {
          navigation.replace('Studio', { projectId });
          return;
        }
        if (returnTo === 'project') {
          navigation.replace('ProjectDetail', { projectId });
          return;
        }
      }

      if (returnTo === 'output' && draftId) {
        navigation.replace('Output', { draftId });
        return;
      }

      navigation.replace('EntryDetail', { entryId, autoExtract: true });
    } catch (e: any) {
      setError(e?.message || 'Failed to finish recording');
    } finally {
      setIsStopping(false);
    }
  }

  return (
    <ScreenLayout title="" headerShown={false} contentPaddingTop={0}>
      <View style={styles.screen}>
        <Toast message={toastMessage} tone="danger" onHide={() => setToastMessage(null)} />
        <View
          pointerEvents="none"
          style={[
            styles.backdropPlanePrimary,
            {
              width: visualSize * 1.06,
              height: visualSize * 1.82,
              top: metrics.headerTopGap + 84,
              left: -visualSize * 0.24,
              transform: [{ rotate: '-10deg' }],
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.backdropPlaneSecondary,
            {
              width: visualSize * 0.92,
              height: visualSize * 1.18,
              bottom: metrics.bottomControlHeight + 36,
              right: -visualSize * 0.3,
              transform: [{ rotate: '11deg' }],
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.backdropRule,
            {
              height: visualSize * 1.24,
              top: metrics.headerTopGap + 118,
              left: metrics.horizontalFrame + visualSize * 0.28,
            },
          ]}
        />

        <View
          style={[
            styles.stage,
            {
              paddingTop: metrics.headerTopGap,
              paddingBottom: Math.max(metrics.stackGap, tokens.space[24]),
              paddingHorizontal: metrics.horizontalFrame,
            },
          ]}
        >
          <View style={[styles.header, { minHeight: metrics.headerMinHeight }]}> 
            <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.chromeButton}>
              <Ionicons name="close" size={18} color={tokens.color.textMuted} />
            </Pressable>

            <View style={styles.timeCluster}>
              <Text style={styles.timeValue}>{formatTime(elapsedSec)}</Text>
              <Text numberOfLines={1} style={styles.timeSubvalue}>{sessionTitle}</Text>
            </View>

            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.hero}>
            <View style={styles.heroCenter}>
              <View style={styles.contextPill}>
                <Text style={styles.contextPillText}>{contextLabel}</Text>
              </View>
              {captureContextTitle ? (
                <View style={styles.captureContextCard}>
                  <Text style={styles.captureContextTitle}>{captureContextTitle}</Text>
                  {captureContextNote ? <Text style={styles.captureContextNote}>{captureContextNote}</Text> : null}
                </View>
              ) : null}

              <Animated.View
                pointerEvents="none"
                style={[
                  styles.micHalo,
                  {
                    width: visualSize * 1.38,
                    height: visualSize * 1.38,
                    borderRadius: visualSize,
                    opacity: captureState === 'recording' ? 0.22 : captureState === 'processing' ? 0.18 : captureState === 'listening' ? 0.12 : 0.08,
                    transform: [{ scale: captureState === 'recording' ? ringScale : 1 }],
                  },
                ]}
              />
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.micHaloHot,
                  {
                    width: visualSize * 0.96,
                    height: visualSize * 0.96,
                    borderRadius: visualSize,
                    opacity: captureState === 'recording' ? ringOpacity : captureState === 'processing' ? 0.16 : 0,
                    transform: [{ scale: captureState === 'recording' ? ringScale : 1 }],
                  },
                ]}
              />

              <Pressable
                accessibilityRole="button"
                disabled={isStarting || isStopping}
                onPress={hasSession ? togglePause : startRecording}
                style={styles.micTapTarget}
              >
                <Animated.View
                  style={{
                    transform: [{ scale: captureState === 'processing' ? 1 : coreScale }],
                  }}
                >
                  <ScribbleMic
                    size={visualSize}
                    iconSize={Math.max(44, Math.round(visualSize * 0.2))}
                    aggressive={captureState === 'recording' || captureState === 'processing'}
                    auraColor={captureState === 'processing' ? '#ff6b47' : '#ff5a36'}
                    orbitalColor={captureState === 'recording' || captureState === 'processing' ? tokens.color.brand : tokens.color.text}
                    coreBackgroundColor={
                      captureState === 'processing'
                        ? '#0f0f10'
                        : captureState === 'recording'
                          ? '#111111'
                          : captureState === 'listening'
                            ? '#141414'
                            : '#161616'
                    }
                    coreBorderColor={
                      captureState === 'recording'
                        ? 'rgba(255, 106, 61, 0.72)'
                        : captureState === 'processing'
                          ? 'rgba(255, 106, 61, 0.62)'
                          : 'rgba(255, 106, 61, 0.34)'
                    }
                    coreShadowColor={captureState === 'processing' ? '#ff6b47' : '#ff5a36'}
                    iconColor={
                      captureState === 'recording'
                        ? '#ff6b47'
                        : captureState === 'processing'
                          ? '#ff7f5f'
                          : 'rgba(255,255,255,0.94)'
                    }
                  />
                </Animated.View>
              </Pressable>

              {captureState === 'idle' ? null : <Text style={[styles.stateTitle, captureState === 'recording' ? styles.stateTitleRecording : null]}>{captureStateLabel}</Text>}
              <Text numberOfLines={2} style={[styles.stageLine, captureState === 'recording' ? styles.stageLineRecording : null]}>{focalMessage}</Text>
            </View>
          </View>

          <View style={styles.footer}>
            {(hasSession || displayMeter01 > 0.02) ? (
              <View style={styles.meterShell}>
                <View style={styles.meterHeader}>
                  <Text style={styles.meterLabel}>Input</Text>
                  <Text style={styles.meterValue}>{captureState === 'processing' ? 'Processing' : micStatusText}</Text>
                </View>
                <View style={styles.meterTrack}>
                  <View style={[styles.meterFill, { width: `${Math.max(8, Math.round(displayMeter01 * 100))}%` }]} />
                </View>
              </View>
            ) : null}

            {(captureState === 'recording' || captureState === 'processing') && footerCue ? (
              <Animated.View
                style={[
                  styles.cueCard,
                  {
                    opacity: signalSwap,
                    transform: [
                      {
                        translateY: signalSwap.interpolate({
                          inputRange: [0, 1],
                          outputRange: [6, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <Text style={styles.cueEyebrow}>{captureState === 'processing' ? 'Processing' : displayedSignal ? signalLabel(displayedSignal.kind) : 'Capture'}</Text>
                <Text numberOfLines={2} style={styles.cueText}>{footerCue}</Text>
              </Animated.View>
            ) : null}

            {!hasSession ? (
              <View style={styles.idleHint}>
                <Ionicons name="radio-outline" size={14} color={tokens.color.textFaint} />
                <Text numberOfLines={1} style={styles.idleHintText}>{handsFreeHint}</Text>
              </View>
            ) : !isStopping ? (
              <View style={styles.actionRow}>
                <Pressable style={styles.discardButton} disabled={isStarting || isStopping} onPress={() => navigation.goBack()}>
                  <Text style={styles.discardText}>Discard</Text>
                </Pressable>

                <LinearGradient
                  colors={['rgba(255, 90, 54, 0.9)', 'rgba(255, 90, 54, 0.38)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.finishRing}
                >
                  <Pressable style={styles.finishButton} disabled={isStopping} onPress={stopRecording}>
                    <Ionicons name="sparkles" size={16} color={tokens.color.surface} />
                    <Text style={styles.finishText}>Finish capture</Text>
                  </Pressable>
                </LinearGradient>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </ScreenLayout>
  );
}

function guessAudioMimeType(uri: string): string | undefined {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.mp4')) return 'audio/mp4';
  if (lower.endsWith('.aac')) return 'audio/aac';
  if (lower.endsWith('.3gp')) return 'audio/3gpp';
  if (lower.endsWith('.caf')) return 'audio/x-caf';
  if (lower.endsWith('.wav')) return 'audio/wav';
  return undefined;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: tokens.color.bg,
    overflow: 'hidden',
  },
  backdropPlanePrimary: {
    position: 'absolute',
    borderRadius: 42,
    backgroundColor: 'rgba(255, 90, 54, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 54, 0.06)',
  },
  backdropPlaneSecondary: {
    position: 'absolute',
    borderRadius: 42,
    backgroundColor: 'rgba(17, 17, 17, 0.045)',
  },
  backdropRule: {
    position: 'absolute',
    width: 1,
    backgroundColor: 'rgba(255, 90, 54, 0.1)',
  },
  stage: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space[12],
  },
  chromeButton: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  timeCluster: {
    flex: 1,
    alignItems: 'center',
    gap: tokens.space[4],
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  timeValue: {
    fontSize: tokens.font.size[24],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
    letterSpacing: -0.4,
  },
  timeSubvalue: {
    maxWidth: '88%',
    fontSize: tokens.font.size[12],
    color: '#8a827a',
    textAlign: 'center',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCenter: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space[16],
  },
  contextPill: {
    paddingHorizontal: tokens.space[12],
    paddingVertical: tokens.space[8],
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  contextPillText: {
    fontSize: tokens.font.size[10],
    fontWeight: tokens.font.weight.semibold,
    letterSpacing: 1.2,
    color: tokens.color.textMuted,
  },
  captureContextCard: {
    maxWidth: '82%',
    paddingHorizontal: tokens.space[12],
    paddingVertical: tokens.space[12],
    borderRadius: tokens.radius[16],
    backgroundColor: 'rgba(255,255,255,0.76)',
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 54, 0.12)',
    gap: tokens.space[4],
  },
  captureContextTitle: {
    fontSize: tokens.font.size[12],
    color: tokens.color.text,
    fontWeight: tokens.font.weight.semibold,
    textAlign: 'center',
  },
  captureContextNote: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
    lineHeight: 18,
    textAlign: 'center',
  },
  micHalo: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 90, 54, 0.12)',
  },
  micHaloHot: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 90, 54, 0.18)',
  },
  micTapTarget: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  stateTitle: {
    fontSize: tokens.font.size[28],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
    letterSpacing: -0.6,
  },
  stateTitleRecording: {
    color: '#d84d2d',
  },
  stageLine: {
    maxWidth: '78%',
    fontSize: tokens.font.size[14],
    color: tokens.color.textMuted,
    lineHeight: 20,
    textAlign: 'center',
  },
  stageLineRecording: {
    color: '#8a4434',
  },
  footer: {
    gap: tokens.space[12],
    paddingBottom: tokens.space[8],
    minHeight: 108,
    justifyContent: 'flex-end',
  },
  meterShell: {
    gap: tokens.space[8],
  },
  meterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space[12],
  },
  meterLabel: {
    fontSize: tokens.font.size[10],
    fontWeight: tokens.font.weight.semibold,
    letterSpacing: 1.1,
    color: tokens.color.textFaint,
    textTransform: 'uppercase',
  },
  meterValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
  },
  meterTrack: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(17, 17, 17, 0.06)',
  },
  meterFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: tokens.color.brand,
  },
  cueCard: {
    borderRadius: tokens.radius[16],
    paddingHorizontal: tokens.space[16],
    paddingVertical: tokens.space[16],
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
    gap: tokens.space[4],
  },
  cueEyebrow: {
    fontSize: tokens.font.size[10],
    fontWeight: tokens.font.weight.semibold,
    letterSpacing: 1.1,
    color: tokens.color.textFaint,
    textTransform: 'uppercase',
  },
  cueText: {
    fontSize: tokens.font.size[14],
    lineHeight: 20,
    color: tokens.color.text,
  },
  idleHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space[8],
    paddingHorizontal: tokens.space[12],
    paddingVertical: tokens.space[8],
    alignSelf: 'center',
  },
  idleHintText: {
    maxWidth: '84%',
    fontSize: tokens.font.size[12],
    color: tokens.color.textFaint,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[12],
  },
  discardButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderWidth: 1,
    borderColor: tokens.color.borderSubtle,
  },
  discardText: {
    fontSize: tokens.font.size[14],
    color: tokens.color.textMuted,
    fontWeight: tokens.font.weight.medium,
  },
  finishRing: {
    flex: 1.3,
    borderRadius: 999,
    padding: 2,
  },
  finishButton: {
    minHeight: 48,
    borderRadius: 999,
    backgroundColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: tokens.space[8],
  },
  finishText: {
    fontSize: tokens.font.size[14],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.surface,
  },
});
