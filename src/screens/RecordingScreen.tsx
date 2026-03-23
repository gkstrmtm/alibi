import { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

import { analyzeLiveSession, extractEntry, type LiveSessionSignal, analyzeLiveSessionVoice, generateReadbackAudio, prepareReadbackAudio } from '../api/alibiApi';
import type { RootStackParamList } from '../navigation/types';
import { ScribbleMic } from '../components/ScribbleMic';
import { ScreenLayout } from '../components/ScreenLayout';
import { Toast } from '../components/Toast';
import { buildProjectProfiles, deriveCaptureContext } from '../intelligence/recordingIntelligence';
import { getLayoutMetrics } from '../theme/layout';
import { tokens } from '../theme/tokens';
import { useAppStore } from '../store/store';
import { makeInstantRecordingTitle } from '../utils/entryTitles';
import { estimateVoiceDurationSecFromTranscript } from '../utils/entryDuration';
import { triggerMediumFeedback, triggerSoftFeedback, triggerSuccessFeedback } from '../utils/feedback';
import { makeId } from '../utils/id';
import { readFileAsBase64 } from '../utils/fileAccess';
import { goBackOrNavigate, recordingFallback } from '../utils/navigation';
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
  recentGlobalEntries?: string[];
  recentProjects?: string[];
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

  return /another request is active|another request is started|request is active|recognizer busy|already started|audio.*active|busy/i.test(message);
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

  return /\babort(ed)?\b|cancelled|canceled|no-speech|no speech|interrupted|speech.*ended|recognition.*ended|another request is started|another request is active|request is active|already started|recognizer busy/.test(message);
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

function mimeTypeToExtension(mimeType: string) {
  if (mimeType.includes('mpeg')) return 'mp3';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('aac')) return 'aac';
  if (mimeType.includes('ogg')) return 'ogg';
  return 'mp4';
}

function pushUint16(bytes: number[], value: number) {
  bytes.push(value & 0xff, (value >> 8) & 0xff);
}

function pushUint32(bytes: number[], value: number) {
  bytes.push(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >> 24) & 0xff);
}

function encodeBase64(bytes: number[]) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';

  for (let index = 0; index < bytes.length; index += 3) {
    const byte1 = bytes[index] ?? 0;
    const byte2 = bytes[index + 1] ?? 0;
    const byte3 = bytes[index + 2] ?? 0;
    const chunk = (byte1 << 16) | (byte2 << 8) | byte3;

    output += chars[(chunk >> 18) & 63];
    output += chars[(chunk >> 12) & 63];
    output += index + 1 < bytes.length ? chars[(chunk >> 6) & 63] : '=';
    output += index + 2 < bytes.length ? chars[chunk & 63] : '=';
  }

  return output;
}

function createSilentAudioUri(durationMs = 90) {
  const sampleRate = 22050;
  const sampleCount = Math.max(1, Math.floor((durationMs / 1000) * sampleRate));
  const samples: number[] = [];

  for (let index = 0; index < sampleCount; index += 1) {
    pushUint16(samples, 0);
  }

  const header: number[] = [];
  header.push(...Array.from('RIFF').map((char) => char.charCodeAt(0)));
  pushUint32(header, 36 + samples.length);
  header.push(...Array.from('WAVE').map((char) => char.charCodeAt(0)));
  header.push(...Array.from('fmt ').map((char) => char.charCodeAt(0)));
  pushUint32(header, 16);
  pushUint16(header, 1);
  pushUint16(header, 1);
  pushUint32(header, sampleRate);
  pushUint32(header, sampleRate * 2);
  pushUint16(header, 2);
  pushUint16(header, 16);
  header.push(...Array.from('data').map((char) => char.charCodeAt(0)));
  pushUint32(header, samples.length);

  return `data:audio/wav;base64,${encodeBase64([...header, ...samples])}`;
}

async function persistBase64AudioToCache(cacheKey: string, audioBase64: string, mimeType: string) {
  const cacheDirectory = (FileSystem as any).cacheDirectory as string | null | undefined;

  if (Platform.OS === 'web' || !cacheDirectory) {
    return `data:${mimeType};base64,${audioBase64}`;
  }

  const directoryUri = `${cacheDirectory}live-voice/`;
  await FileSystem.makeDirectoryAsync(directoryUri, { intermediates: true }).catch(() => {});

  const fileUri = `${directoryUri}${hashString(cacheKey)}.${mimeTypeToExtension(mimeType)}`;
  const fileInfo = await FileSystem.getInfoAsync(fileUri).catch(() => ({ exists: false }));
  if (!fileInfo.exists) {
    await FileSystem.writeAsStringAsync(fileUri, audioBase64, { encoding: (FileSystem as any).EncodingType.Base64 });
  }

  return fileUri;
}

function createWebAudioUrl(audioBase64: string, mimeType: string) {
  const cleaned = audioBase64.includes('base64,') ? audioBase64.slice(audioBase64.indexOf('base64,') + 'base64,'.length) : audioBase64;

  try {
    const atobFn = (globalThis as any)?.atob;
    const BlobCtor = (globalThis as any)?.Blob;
    const URLCtor = (globalThis as any)?.URL;

    if (typeof atobFn === 'function' && typeof BlobCtor === 'function' && typeof URLCtor?.createObjectURL === 'function') {
      const binary = atobFn(cleaned);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }

      return URLCtor.createObjectURL(new BlobCtor([bytes], { type: mimeType }));
    }
  } catch {
    // fall back to data URI below
  }

  return `data:${mimeType};base64,${cleaned}`;
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
  const targetProperty = route.params?.targetProperty;
  const intakeKey = route.params?.intakeKey;
  const recordingTitle = promptLabel ? makeInstantRecordingTitle({ promptLabel }) : undefined;
  const recordingIntent = intakeKey ? `intake:${intakeKey}` : undefined;
  const project = projectId ? state.projects[projectId] : undefined;
  const projectName = projectId ? state.projects[projectId]?.name : undefined;
  const backTarget = recordingFallback(route.params);

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [meter01, setMeter01] = useState<number>(0);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [analysisTranscript, setAnalysisTranscript] = useState('');
  const [hasCapturedSpeech, setHasCapturedSpeech] = useState(false);
  const [isLiveThinking, setIsLiveThinking] = useState(false);
  const [isAgentSpeaking, setIsAgentSpeaking] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isAgentMuted, setIsAgentMuted] = useState(false);
  const [liveSignalError, setLiveSignalError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lastHeardSnippet, setLastHeardSnippet] = useState('');
  const [lastAgentReply, setLastAgentReply] = useState('');
  const [agentPlaybackState, setAgentPlaybackState] = useState<'idle' | 'generating' | 'playing' | 'blocked' | 'error'>('idle');

  const pulse = useRef(new Animated.Value(0)).current;
  const level = useRef(new Animated.Value(0)).current;
  const windup = useRef(new Animated.Value(0)).current;
  const transcriptTallyRef = useRef('');
  const lastApiSignalAtRef = useRef(0);
  const agentSoundRef = useRef<Audio.Sound | null>(null);
  const webAgentAudioRef = useRef<any>(null);
  const webAgentAudioUrlRef = useRef<string | null>(null);
  const webAudioUnlockedRef = useRef(false);
  const agentAudioPrimedRef = useRef(false);
  const voicePreflightStateRef = useRef<'idle' | 'checking' | 'ready' | 'failed'>('idle');
  const speechPermissionGrantedRef = useRef(false);
  const speechRecognitionActiveRef = useRef(false);
  const speechTransitionRef = useRef(false);
  const liveSpeechDisabledRef = useRef(false);
  const liveVoiceAbortRef = useRef<AbortController | null>(null);
  const agentPlaybackAbortRef = useRef<AbortController | null>(null);
  const speechShouldRunRef = useRef(false);
  const passiveCommandModeRef = useRef(false);
  const commandLockRef = useRef(false);
  const activityStepRef = useRef(0);
  const lastMeterPushAtRef = useRef(0);
  const meterValueRef = useRef(0);
  const liveTranscriptRef = useRef('');
  const transcriptFlushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analysisTranscriptTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasPlayedStartIntroRef = useRef(false);
  const hasSession = isWeb ? isRecording || isStopping || elapsedSec > 0 : Boolean(recording);
  const replyWordThreshold = 3;
  const replySettleDelayMs = 280;
  const replySilenceDelayMs = 900;
  const replyCooldownMs = 1200;
  const captureContext = useMemo(() => deriveCaptureContext(projectId, draftId), [draftId, projectId]);
  const projectProfiles = useMemo(() => buildProjectProfiles(state), [state]);

  const projectContext = useMemo(() => {
    if (!project) {
      const recentGlobalEntries = Object.values(state.entries)
        .filter((entry): entry is NonNullable<typeof state.entries[string]> => Boolean(entry && entry.status === 'extracted'))
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 3)
        .map((e) => e.title ?? '')
        .filter(Boolean);

      const recentProjects = Object.values(state.projects)
        .filter((p): p is NonNullable<typeof state.projects[string]> => Boolean(p))
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 3)
        .map((p) => p.name ?? '')
        .filter(Boolean);

      if (!recentGlobalEntries.length && !recentProjects.length) return undefined;

      return {
        recentGlobalEntries,
        recentProjects,
      };
    }

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

  function updateMeter(nextValue: number, options?: { force?: boolean }) {
    const clamped = Math.max(0, Math.min(1, nextValue));
    const now = Date.now();
    const force = Boolean(options?.force);
    meterValueRef.current = clamped;

    setMeter01((current) => {
      if (!force && now - lastMeterPushAtRef.current < 90 && Math.abs(current - clamped) < 0.06) {
        return current;
      }

      lastMeterPushAtRef.current = now;
      return clamped;
    });
  }

  function markHeard(baseLevel = 0.42) {
    activityStepRef.current = (activityStepRef.current + 1) % 4;
    const offsets = [0.1, 0.2, 0.14, 0.24];
    const nextOffset = offsets[activityStepRef.current] ?? 0.1;
    const nextLevel = Math.min(1, baseLevel + nextOffset);

    updateMeter(Math.max(meterValueRef.current * 0.55, nextLevel));
  }

  function flushLiveTranscript(options?: { immediate?: boolean }) {
    const nextTranscript = liveTranscriptRef.current;

    if (options?.immediate && transcriptFlushTimeoutRef.current) {
      clearTimeout(transcriptFlushTimeoutRef.current);
      transcriptFlushTimeoutRef.current = null;
    }

    if (nextTranscript.trim()) {
      setHasCapturedSpeech(true);
    }

    setLiveTranscript((current) => (current === nextTranscript ? current : nextTranscript));
  }

  function queueLiveTranscript(nextTranscript: string, options?: { immediate?: boolean }) {
    liveTranscriptRef.current = nextTranscript;

    if (options?.immediate) {
      flushLiveTranscript({ immediate: true });
      return;
    }

    if (transcriptFlushTimeoutRef.current) return;

    transcriptFlushTimeoutRef.current = setTimeout(() => {
      transcriptFlushTimeoutRef.current = null;
      flushLiveTranscript();
    }, 180);
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

  async function setConversationAudioMode(mode: 'record' | 'playback') {
    if (isWeb) return;

    if (mode === 'record') {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    });
  }

  async function unloadAgentSound() {
    const activeWebAudioUrl = webAgentAudioUrlRef.current;
    webAgentAudioUrlRef.current = null;
    if (activeWebAudioUrl?.startsWith('blob:')) {
      try {
        (globalThis as any)?.URL?.revokeObjectURL?.(activeWebAudioUrl);
      } catch {
        // ignore object URL cleanup failures
      }
    }

    const activeWebAudio = webAgentAudioRef.current;
    webAgentAudioRef.current = null;
    if (activeWebAudio) {
      try {
        activeWebAudio.pause?.();
        activeWebAudio.onended = null;
        activeWebAudio.onerror = null;
        activeWebAudio.src = '';
        activeWebAudio.load?.();
      } catch {
        // ignore browser audio cleanup failures
      }
    }

    const activeSound = agentSoundRef.current;
    agentSoundRef.current = null;
    if (!activeSound) return;

    try {
      activeSound.setOnPlaybackStatusUpdate(null);
    } catch {
      // ignore callback reset failures
    }

    try {
      await activeSound.stopAsync();
    } catch {
      // ignore stop failures
    }

    try {
      await activeSound.unloadAsync();
    } catch {
      // ignore unload failures
    }
  }

  async function resumeLiveCaptureAfterAgent() {
    setIsAgentSpeaking(false);
    setAgentPlaybackState((current) => (current === 'blocked' || current === 'error' ? current : 'idle'));
    speechTransitionRef.current = false;
    
    setAnalysisTranscript('');
    setLiveTranscript('');
    liveTranscriptRef.current = '';
    transcriptTallyRef.current = '';

    if (isMicMuted) return;

    try {
      await setConversationAudioMode('record');
      if (!isWeb && recordingRef.current) {
        await recordingRef.current.startAsync().catch(() => {});
      }

      if (!liveSpeechDisabledRef.current) {
        speechShouldRunRef.current = true;
        await startSpeechRecognitionSession({ allowBusyFailure: true, disableLiveOnFailure: true });
      }

      setIsRecording(true);
    } catch (e: any) {
      setToastMessage(e?.message || 'Mic could not resume.');
    }
  }

  async function playAgentResponse(text: string) {
    if (!text.trim() || isAgentMuted) return;

    setLastAgentReply(text.trim());
    setAgentPlaybackState('generating');

    agentPlaybackAbortRef.current?.abort();
    const playbackController = new AbortController();
    agentPlaybackAbortRef.current = playbackController;

    const audioRes = await generateReadbackAudio(
      { text, render: 'spoken' },
      { baseUrl: state.settings.apiBaseUrlOverride, signal: playbackController.signal },
    );

    if (playbackController.signal.aborted) {
      setAgentPlaybackState('idle');
      return;
    }

    if (!audioRes.ok) {
      voicePreflightStateRef.current = 'failed';
      setAgentPlaybackState('error');
      setToastMessage(audioRes.error || 'Failed to generate voice response.');
      return;
    }

    speechTransitionRef.current = true;
    setIsAgentSpeaking(true);
    setIsRecording(false);

    await stopSpeechRecognitionSession();

    if (!isWeb && recordingRef.current) {
      await recordingRef.current.pauseAsync().catch(() => {});
    }

    try {
      await setConversationAudioMode('playback');
      await unloadAgentSound();

      if (isWeb) {
        const BrowserAudio = (globalThis as any)?.Audio;
        if (typeof BrowserAudio !== 'function') {
          throw new Error('Browser audio is unavailable.');
        }

        const audioUri = createWebAudioUrl(audioRes.audioBase64, audioRes.mimeType);
        webAgentAudioUrlRef.current = audioUri;
        const browserAudio = new BrowserAudio(audioUri);
        browserAudio.preload = 'auto';
        browserAudio.playsInline = true;
        browserAudio.muted = false;
        browserAudio.volume = 1;
        webAgentAudioRef.current = browserAudio;

        browserAudio.onended = () => {
          void unloadAgentSound().finally(() => {
            void resumeLiveCaptureAfterAgent();
          });
        };

        browserAudio.onerror = () => {
          setAgentPlaybackState('error');
          setToastMessage('Voice playback failed.');
          void unloadAgentSound().finally(() => {
            void resumeLiveCaptureAfterAgent();
          });
        };

        try {
          await browserAudio.play();
          webAudioUnlockedRef.current = true;
          setAgentPlaybackState('playing');
          return;
        } catch (e: any) {
          setAgentPlaybackState('blocked');
          throw new Error(e?.message || 'Browser blocked voice playback.');
        }
      }

      const audioUri = await persistBase64AudioToCache(`live:${text}`, audioRes.audioBase64, audioRes.mimeType);

      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true, progressUpdateIntervalMillis: 200 },
      );

      agentSoundRef.current = sound;
      setAgentPlaybackState('playing');
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) {
          if ((status as any).error) {
            voicePreflightStateRef.current = 'failed';
            setAgentPlaybackState('error');
            setToastMessage('Voice playback failed.');
            void unloadAgentSound().finally(() => {
              void resumeLiveCaptureAfterAgent();
            });
          }
          return;
        }

        if (status.didJustFinish) {
          void unloadAgentSound().finally(() => {
            void resumeLiveCaptureAfterAgent();
          });
        }
      });
    } catch (e: any) {
      await unloadAgentSound();
      voicePreflightStateRef.current = 'failed';
      setAgentPlaybackState((current) => (current === 'blocked' ? current : 'error'));
      setToastMessage(e?.message || 'Voice playback failed.');
      await resumeLiveCaptureAfterAgent();
    }
  }

  async function playStartIntro() {
    if (hasPlayedStartIntroRef.current || isAgentMuted) return;

    hasPlayedStartIntroRef.current = true;
    setAnalysisTranscript('');
    setLiveTranscript('');
    liveTranscriptRef.current = '';
    transcriptTallyRef.current = '';

    try {
      const kickoffPrompt = promptLabel
        ? `Start with this: ${promptLabel.replace(/\s+/g, ' ').trim()}`.slice(0, 180)
        : "I'm here. Start talking whenever you're ready.";
      await playAgentResponse(kickoffPrompt);
    } catch (e: any) {
      setToastMessage(e?.message || 'Voice intro failed.');
    }
  }

  async function primeAgentAudioOutput() {
    if (agentAudioPrimedRef.current) return;

    if (isWeb) {
      const BrowserAudio = (globalThis as any)?.Audio;
      if (typeof BrowserAudio !== 'function') {
        return;
      }

      try {
        const browserAudio = new BrowserAudio(createSilentAudioUri());
        browserAudio.muted = true;
        browserAudio.playsInline = true;
        await browserAudio.play();
        browserAudio.pause();
        browserAudio.currentTime = 0;
        browserAudio.muted = false;
        webAudioUnlockedRef.current = true;
        agentAudioPrimedRef.current = true;
      } catch {
        // Browser may still require another user gesture later.
      }

      return;
    }

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: createSilentAudioUri() },
        { shouldPlay: true, volume: 0 },
      );

      try {
        await sound.stopAsync();
      } catch {
        // ignore
      }

      await sound.unloadAsync().catch(() => {});
      agentAudioPrimedRef.current = true;
    } catch {
      // If priming fails, real playback can still try later.
    }
  }

  async function replayLastAgentVoice() {
    if (!lastAgentReply.trim() || isAgentMuted || isStarting || isStopping || isAgentSpeaking) return;

    try {
      await primeAgentAudioOutput();
      await playAgentResponse(lastAgentReply);
    } catch (e: any) {
      setToastMessage(e?.message || 'Voice playback failed.');
    }
  }

  async function runVoicePreflight() {
    if (isAgentMuted || voicePreflightStateRef.current === 'checking' || voicePreflightStateRef.current === 'ready') {
      return;
    }

    voicePreflightStateRef.current = 'checking';

    try {
      const voiceResult = await analyzeLiveSessionVoice(
        { recentTranscript: 'I am starting a live voice conversation now.' },
        { baseUrl: state.settings.apiBaseUrlOverride },
      );

      if (!voiceResult.ok) {
        throw new Error(voiceResult.error);
      }

      const prepResult = await prepareReadbackAudio(
        { text: voiceResult.speechResponse || 'Voice mode is ready.', render: 'spoken' },
        { baseUrl: state.settings.apiBaseUrlOverride },
      );

      if (!prepResult.ok) {
        throw new Error(prepResult.error);
      }

      voicePreflightStateRef.current = 'ready';
    } catch (e: any) {
      voicePreflightStateRef.current = 'failed';
      setToastMessage(e?.message || 'Voice replies are unavailable right now.');
    }
  }

  async function toggleMicMute() {
    if (!hasSession || isStarting || isStopping) return;

    if (isMicMuted) {
      setIsMicMuted(false);

      if (isAgentSpeaking) {
        return;
      }

      try {
        await setConversationAudioMode('record');
        if (!isWeb && recordingRef.current) {
          await recordingRef.current.startAsync();
        }
        if (!liveSpeechDisabledRef.current) {
          speechShouldRunRef.current = true;
          await startSpeechRecognitionSession({ allowBusyFailure: true, disableLiveOnFailure: true });
        }
        setIsRecording(true);
      } catch (e: any) {
        setIsMicMuted(true);
        setToastMessage(e?.message || 'Mic could not resume.');
      }

      return;
    }

    setIsMicMuted(true);

    if (isAgentSpeaking) {
      return;
    }

    setIsRecording(false);
    speechShouldRunRef.current = false;
    await stopSpeechRecognitionSession();
    if (!isWeb && recordingRef.current) {
      await recordingRef.current.pauseAsync().catch(() => {});
    }
  }

  async function toggleAgentMute() {
    const nextMuted = !isAgentMuted;
    setIsAgentMuted(nextMuted);

    if (!nextMuted) {
      voicePreflightStateRef.current = 'idle';
      void runVoicePreflight();
      return;
    }

    liveVoiceAbortRef.current?.abort();
    liveVoiceAbortRef.current = null;
    agentPlaybackAbortRef.current?.abort();
    agentPlaybackAbortRef.current = null;
    await unloadAgentSound();

    if (isAgentSpeaking) {
      await resumeLiveCaptureAfterAgent();
    }
  }

  async function handleExit() {
    if (hasSession) {
      await stopRecording();
      return;
    }

    goBackOrNavigate(navigation, backTarget);
  }

  async function handleDiscard() {
    if (!hasSession) return;
    setIsStopping(true);
    try {
      liveVoiceAbortRef.current?.abort();
      liveVoiceAbortRef.current = null;
      agentPlaybackAbortRef.current?.abort();
      agentPlaybackAbortRef.current = null;
      await unloadAgentSound();
      setIsAgentSpeaking(false);
      speechShouldRunRef.current = false;
      await stopSpeechRecognitionSession();
      if (!isWeb && recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
      setRecording(null);
      recordingRef.current = null;
      setIsRecording(false);
      
      triggerMediumFeedback();
      goBackOrNavigate(navigation, backTarget);
    } catch {
      goBackOrNavigate(navigation, backTarget);
    } finally {
      setIsStopping(false);
    }
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

        await setConversationAudioMode('record');

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
      if (transcriptFlushTimeoutRef.current) {
        clearTimeout(transcriptFlushTimeoutRef.current);
        transcriptFlushTimeoutRef.current = null;
      }
      if (analysisTranscriptTimeoutRef.current) {
        clearTimeout(analysisTranscriptTimeoutRef.current);
        analysisTranscriptTimeoutRef.current = null;
      }
      liveVoiceAbortRef.current?.abort();
      void unloadAgentSound();
      void stopSpeechRecognitionSession();
      if (recordingRef.current) recordingRef.current.stopAndUnloadAsync().catch(() => {});
    };
    // Don't add `recording` as a dependency; we only want mount/unmount behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWeb]);

  useEffect(() => {
    speechShouldRunRef.current = isRecording && !isStopping;

    if (!isRecording && transcriptFlushTimeoutRef.current) {
      clearTimeout(transcriptFlushTimeoutRef.current);
      transcriptFlushTimeoutRef.current = null;
    }

    if (!isRecording && analysisTranscriptTimeoutRef.current) {
      clearTimeout(analysisTranscriptTimeoutRef.current);
      analysisTranscriptTimeoutRef.current = null;
    }
  }, [isRecording, isStopping]);

  useEffect(() => {
    if (analysisTranscriptTimeoutRef.current) {
      clearTimeout(analysisTranscriptTimeoutRef.current);
      analysisTranscriptTimeoutRef.current = null;
    }

    if (!isRecording) {
      setAnalysisTranscript('');
      return;
    }

    if (!liveTranscript.trim()) {
      setAnalysisTranscript('');
      return;
    }

    analysisTranscriptTimeoutRef.current = setTimeout(() => {
      analysisTranscriptTimeoutRef.current = null;
      setAnalysisTranscript((current) => (current === liveTranscript ? current : liveTranscript));
    }, replySettleDelayMs);

    return () => {
      if (analysisTranscriptTimeoutRef.current) {
        clearTimeout(analysisTranscriptTimeoutRef.current);
        analysisTranscriptTimeoutRef.current = null;
      }
    };
  }, [isRecording, liveTranscript]);

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
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [isRecording, pulse]);

  useEffect(() => {
    const floor = isRecording ? (hasCapturedSpeech ? 0.08 : 0.045) : 0;
    const target = isRecording ? Math.max(meter01, floor) : 0;

    Animated.spring(level, {
      toValue: target,
      stiffness: 180,
      damping: 26,
      mass: 1,
      useNativeDriver: true,
    }).start();
  }, [hasCapturedSpeech, isRecording, level, meter01]);

  useEffect(() => {
    if (!isRecording) {
      updateMeter(0, { force: true });
      return;
    }

    const id = setInterval(() => {
      setMeter01((current) => {
        if (current <= 0.03) {
          meterValueRef.current = 0;
          lastMeterPushAtRef.current = Date.now();
          return 0;
        }

        const next = Math.max(0, current * 0.84 - 0.015);
        if (Math.abs(next - current) < 0.035) {
          meterValueRef.current = current;
          return current;
        }

        meterValueRef.current = next;
        lastMeterPushAtRef.current = Date.now();
        return next;
      });
    }, 120);

    return () => clearInterval(id);
  }, [isRecording]);

  const ringScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.24],
  });

  const ringOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.22, 0],
  });

  const coreScale = level.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.035],
  });

  const visualSize = Math.min(metrics.contentWidth * 0.68, metrics.immersiveHeroHeight * 0.55);
  const captureState: 'idle' | 'listening' | 'recording' | 'processing' = isStopping
    ? 'processing'
    : hasSession
      ? isRecording
        ? 'recording'
        : 'listening'
      : 'idle';
  const statusPills = [
    agentPlaybackState === 'blocked'
      ? { key: 'playback-blocked', label: 'Voice ready to play', tone: 'muted' as const }
      : null,
    agentPlaybackState === 'error'
      ? { key: 'playback-error', label: 'Voice playback failed', tone: 'muted' as const }
      : null,
    hasSession && !isMicMuted && !isAgentMuted && !isAgentSpeaking && !isLiveThinking
      ? { key: 'listening', label: 'Listening...', tone: 'live' as const }
      : null,
    isMicMuted ? { key: 'mic-muted', label: 'Mic muted', tone: 'muted' as const } : null,
    isAgentMuted ? { key: 'agent-muted', label: 'Agent voice off', tone: 'muted' as const } : null,
    !isAgentMuted && isAgentSpeaking ? { key: 'agent-speaking', label: 'Agent speaking', tone: 'live' as const } : null,
    !isMicMuted && !isAgentSpeaking && (isLiveThinking || agentPlaybackState === 'generating') ? { key: 'agent-thinking', label: 'Thinking...', tone: 'live' as const } : null,
  ].filter((pill): pill is { key: string; label: string; tone: 'muted' | 'live' } => Boolean(pill));
  const statusIndicator = !hasSession
    ? 'Tap to start'
    : isAgentSpeaking
      ? 'Speaking...'
      : (isLiveThinking || agentPlaybackState === 'generating')
        ? 'Thinking...'
        : 'Listening...';

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
    if (!isRecording) updateMeter(0, { force: true });
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
      void stopRecording().finally(() => {
        commandLockRef.current = false;
      });
      return;
    }

    if (passiveCommandModeRef.current) return;

    markHeard(event.isFinal ? 0.7 : 0.54);
    setLastHeardSnippet(takeLastWords(`${transcriptTallyRef.current} ${transcript}`.trim(), 12));

    if (event.isFinal) {
      transcriptTallyRef.current = `${transcriptTallyRef.current} ${transcript}`.trim();
      queueLiveTranscript(transcriptTallyRef.current, { immediate: true });
      return;
    }

    queueLiveTranscript(`${transcriptTallyRef.current} ${transcript}`.trim());
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
    if (isIgnorableSpeechMessage(error) || isSpeechRequestConflictError(error)) {
      setError(null);
      return;
    }
    setToastMessage(error);
    setError(null);
  }, [error]);

  useEffect(() => {
    if (!liveSignalError) return;
    if (isIgnorableSpeechMessage(liveSignalError) || isSpeechRequestConflictError(liveSignalError)) {
      setLiveSignalError(null);
      return;
    }
    setToastMessage(liveSignalError);
    setLiveSignalError(null);
  }, [liveSignalError]);

  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if ((!recording && !isWeb) || !isRecording || isMicMuted || isAgentMuted || isAgentSpeaking) {
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      windup.stopAnimation();
      windup.setValue(0);
      return;
    }

    const wordCount = wordsIn(analysisTranscript);
    if (wordCount < replyWordThreshold) {
      if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
      windup.stopAnimation();
      windup.setValue(0);
      return;
    }

    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    liveVoiceAbortRef.current?.abort();
    liveVoiceAbortRef.current = null;
    agentPlaybackAbortRef.current?.abort();
    agentPlaybackAbortRef.current = null;

    windup.stopAnimation();
    windup.setValue(0);
    Animated.timing(windup, {
      toValue: 1,
      duration: replySilenceDelayMs,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    silenceTimeoutRef.current = setTimeout(() => {
      if (speechTransitionRef.current || isAgentMuted || isMicMuted) return;
      if (Date.now() - lastApiSignalAtRef.current < replyCooldownMs) return;

      setIsLiveThinking(true);
      setLiveSignalError(null);

      const controller = new AbortController();
      liveVoiceAbortRef.current = controller;

      analyzeLiveSessionVoice(
        {
          recentTranscript: takeLastWords(analysisTranscript, 140),
          projectContext,
        },
        { baseUrl: state.settings.apiBaseUrlOverride, signal: controller.signal },
      )
        .then((result: any) => {
          if (controller.signal.aborted) return;
          if (!result.ok) {
            setLiveSignalError(result.error);
            return;
          }

          lastApiSignalAtRef.current = Date.now();
          
          setAnalysisTranscript('');
          setLiveTranscript('');
          liveTranscriptRef.current = '';
          transcriptTallyRef.current = '';

          void playAgentResponse(result.speechResponse || '');
        })
        .catch((e: any) => {
          if (controller.signal.aborted || isIgnorableSpeechMessage(e)) return;
          setLiveSignalError(e?.message || 'Voice mode failed.');
        })
        .finally(() => {
          if (liveVoiceAbortRef.current === controller) {
            liveVoiceAbortRef.current = null;
          }
          setIsLiveThinking(false);
          windup.stopAnimation();
          windup.setValue(0);
        });
    }, replySilenceDelayMs);

    return () => {
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      windup.stopAnimation();
      windup.setValue(0);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisTranscript, isRecording, recording, isWeb, projectContext, isAgentMuted, isAgentSpeaking, isMicMuted, replyCooldownMs, replySilenceDelayMs, replyWordThreshold, state.settings.apiBaseUrlOverride, windup]);

  async function startRecording() {
    if (!isReady || recording || isStarting || isStopping) return;
    passiveCommandModeRef.current = false;
    liveSpeechDisabledRef.current = false;
    setError(null);
    setIsStarting(true);
    setElapsedSec(0);
    updateMeter(0, { force: true });
    hasPlayedStartIntroRef.current = false;
    liveTranscriptRef.current = '';
    setHasCapturedSpeech(false);
    setLastHeardSnippet('');
    setLastAgentReply('');
    setAgentPlaybackState('idle');
    setLiveTranscript('');
    setAnalysisTranscript('');
    setLiveSignalError(null);
    lastApiSignalAtRef.current = 0;
    transcriptTallyRef.current = '';
    if (transcriptFlushTimeoutRef.current) {
      clearTimeout(transcriptFlushTimeoutRef.current);
      transcriptFlushTimeoutRef.current = null;
    }
    if (analysisTranscriptTimeoutRef.current) {
      clearTimeout(analysisTranscriptTimeoutRef.current);
      analysisTranscriptTimeoutRef.current = null;
    }
    try {
      await primeAgentAudioOutput();
      await stopSpeechRecognitionSession();

      const recognitionGranted = await requestSpeechPermissionIfNeeded();
      if (!recognitionGranted) {
        throw new Error('Speech recognition permission is required.');
      }

      speechShouldRunRef.current = true;

      if (isWeb) {
        await startSpeechRecognitionSession();
        setIsMicMuted(false);
        setIsRecording(true);
        triggerMediumFeedback();
        void playStartIntro();
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
            updateMeter(v);
          }
        },
        250,
      );

      setRecording(rec);
      recordingRef.current = rec;

      const liveSpeechStarted = await startSpeechRecognitionSession({ allowBusyFailure: true, disableLiveOnFailure: true });

      setIsMicMuted(false);
      setIsRecording(true);
      triggerMediumFeedback();
      if (!liveSpeechStarted) {
        liveSpeechDisabledRef.current = true;
      }
      void playStartIntro();
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
          await startSpeechRecognitionSession({ allowBusyFailure: true, disableLiveOnFailure: true });
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
      liveVoiceAbortRef.current?.abort();
      liveVoiceAbortRef.current = null;
      await unloadAgentSound();
      setIsAgentSpeaking(false);
      speechShouldRunRef.current = false;
      await stopSpeechRecognitionSession();
      flushLiveTranscript({ immediate: true });
      const recognizedTranscript = liveTranscriptRef.current.trim();
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
            captureContext,
            contextAnchor: {
              projectId,
              projectName: project?.name,
              draftId,
              draftTitle: draftId ? state.drafts[draftId]?.title : undefined,
            },
            projectProfiles,
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
              captureContext: result.captureContext ?? captureContext,
              decision: result.decision,
            },
          });
          if (!projectId && result.decision?.autoAssigned && result.decision.primaryProjectId) {
            dispatch({ type: 'project.addEntry', payload: { projectId: result.decision.primaryProjectId, entryId } });
          }
          celebrateCapture();
            if (targetProperty && project?.type === 'book' && projectId) {
              const field = targetProperty.split('.')[1];
              const existingBrief = project.book?.brief || { premise: '', audience: '', tone: '', constraints: '' };
              dispatch({
                type: 'book.setBrief',
                payload: {
                  projectId,
                  brief: {
                    ...existingBrief,
                    [field]: result.transcript || recognizedTranscript || ''
                  }
                }
              });
            }
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
              captureContext,
              contextAnchor: {
                projectId,
                projectName: project?.name,
                draftId,
                draftTitle: draftId ? state.drafts[draftId]?.title : undefined,
              },
              projectProfiles,
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
                captureContext: result.captureContext ?? captureContext,
                decision: result.decision,
              },
            });
            if (!projectId && result.decision?.autoAssigned && result.decision.primaryProjectId) {
              dispatch({ type: 'project.addEntry', payload: { projectId: result.decision.primaryProjectId, entryId } });
            }
            celebrateCapture();
            if (targetProperty && project?.type === 'book' && projectId) {
              const field = targetProperty.split('.')[1];
              const existingBrief = project.book?.brief || { premise: '', audience: '', tone: '', constraints: '' };
              dispatch({
                type: 'book.setBrief',
                payload: {
                  projectId,
                  brief: {
                    ...existingBrief,
                    [field]: result.transcript || recognizedTranscript || ''
                  }
                }
              });
            }
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

        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hasSession ? 'Finish voice session' : 'Exit voice mode'}
            onPress={() => {
              void handleExit();
            }}
            disabled={isStarting || isStopping}
            style={({ pressed }) => [
              styles.chromeButton,
              pressed ? styles.chromeButtonPressed : null,
              isStarting || isStopping ? styles.micTapTargetDisabled : null,
            ]}
          >
            <Ionicons name={hasSession ? 'checkmark' : 'close'} size={20} color={tokens.color.text} />
          </Pressable>

          <View style={styles.topBarActions}>
            {hasSession ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel and discard recording"
                onPress={() => {
                  void handleDiscard();
                }}
                disabled={isStarting || isStopping}
                style={({ pressed }) => [
                  styles.chromeButton,
                  pressed ? styles.chromeButtonPressed : null,
                  isStarting || isStopping ? styles.micTapTargetDisabled : null,
                ]}
              >
                <Ionicons name="trash-outline" size={18} color={tokens.color.danger} />
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
              onPress={() => {
                if (hasSession) {
                  void toggleMicMute();
                }
              }}
              disabled={!hasSession || isStarting || isStopping}
              style={({ pressed }) => [
                styles.chromeButton,
                isMicMuted ? styles.chromeButtonActive : null,
                pressed ? styles.chromeButtonPressed : null,
                !hasSession || isStarting || isStopping ? styles.micTapTargetDisabled : null,
              ]}
            >
              <Ionicons name={isMicMuted ? 'mic-off' : 'mic'} size={18} color={isMicMuted ? tokens.color.surface : tokens.color.text} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={isAgentMuted ? 'Unmute agent voice' : 'Mute agent voice'}
              onPress={() => {
                void toggleAgentMute();
              }}
              disabled={isStarting || isStopping}
              style={({ pressed }) => [
                styles.chromeButton,
                isAgentMuted ? styles.chromeButtonActive : null,
                pressed ? styles.chromeButtonPressed : null,
                isStarting || isStopping ? styles.micTapTargetDisabled : null,
              ]}
            >
              <Ionicons name={isAgentMuted ? 'volume-mute' : 'volume-high'} size={18} color={isAgentMuted ? tokens.color.surface : tokens.color.text} />
            </Pressable>
          </View>
        </View>

        {statusPills.length ? (
          <View pointerEvents="none" style={styles.statusRail}>
            {statusPills.map((pill) => (
              <View
                key={pill.key}
                style={[
                  styles.statusPill,
                  pill.tone === 'live' ? styles.statusPillLive : styles.statusPillMuted,
                ]}
              >
                <View
                  style={[
                    styles.statusPillDot,
                    pill.tone === 'live' ? styles.statusPillDotLive : styles.statusPillDotMuted,
                  ]}
                />
                <Animated.Text style={styles.statusPillText}>{pill.label}</Animated.Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.hero}>
          <View style={styles.heroCenter}>
            <View style={[styles.captureContextCard, { flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
              {statusIndicator === 'Thinking...' ? (
                <>
                  <ActivityIndicator size="small" color={tokens.color.textMuted} />
                  <Animated.Text style={styles.captureContextTitle}>Thinking...</Animated.Text>
                </>
              ) : (
                <Animated.Text style={styles.captureContextTitle}>{statusIndicator}</Animated.Text>
              )}
            </View>

            {promptLabel ? (
              <View style={styles.promptContextCard}>
                <Text style={styles.promptContextEyebrow}>Prompt in play</Text>
                <Text style={styles.promptContextTitle}>{promptLabel}</Text>
              </View>
            ) : null}

            {lastAgentReply && (agentPlaybackState === 'blocked' || agentPlaybackState === 'error') ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Play the last voice reply"
                onPress={() => {
                  void replayLastAgentVoice();
                }}
                style={({ pressed }) => [
                  styles.replayPill,
                  pressed ? styles.replayPillPressed : null,
                ]}
              >
                <Ionicons name={agentPlaybackState === 'blocked' ? 'play-circle-outline' : 'refresh-circle-outline'} size={16} color={tokens.color.brand} />
                <Text style={styles.replayPillText}>{agentPlaybackState === 'blocked' ? 'Play reply aloud' : 'Try voice again'}</Text>
              </Pressable>
            ) : null}

            <Animated.View
              pointerEvents="none"
              style={[
                styles.micHalo,
                {
                  width: visualSize * 1.82,
                  height: visualSize * 1.82,
                  borderRadius: visualSize,
                  opacity: ringOpacity,
                  transform: [{ scale: ringScale }],
                  backgroundColor: 'rgba(255, 90, 54, 0.14)',
                },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.micHalo,
                {
                  width: visualSize * 1.62,
                  height: visualSize * 1.62,
                  borderRadius: visualSize,
                  opacity: windup.interpolate({ inputRange: [0, 1], outputRange: [0, 0.18], extrapolate: 'clamp' }),
                  transform: [{ scale: windup.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08], extrapolate: 'clamp' }) }],
                  backgroundColor: 'rgba(255, 90, 54, 0.22)',
                },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.micHaloHot,
                {
                  width: visualSize * 1.12,
                  height: visualSize * 1.12,
                  borderRadius: visualSize,
                  opacity: level.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5], extrapolate: 'clamp' }),
                  backgroundColor: 'rgba(255, 90, 54, 0.28)',
                },
              ]}
            />

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (hasSession) {
                  void toggleMicMute();
                  return;
                }

                void startRecording();
              }}
              disabled={isStarting || isStopping || (captureState === 'processing' && !recording)}
              style={({ pressed }) => [
                styles.micTapTarget,
                pressed && !(isStarting || isStopping) ? styles.micTapTargetPressed : null,
                isStarting || isStopping ? styles.micTapTargetDisabled : null,
              ]}
            >
              <Animated.View
                style={{
                  transform: [{ scale: captureState === 'recording' ? coreScale : 1 }],
                }}
              >
                <ScribbleMic
                  size={visualSize * 0.9}
                  iconSize={Math.max(48, visualSize * 0.24)}
                  aggressive
                  iconColor={
                    isMicMuted
                      ? 'rgba(255,255,255,0.52)'
                      : captureState === 'processing'
                        ? '#ff7f5f'
                        : tokens.color.brand
                  }
                  coreBackgroundColor="#141414"
                  coreBorderColor={isMicMuted ? 'rgba(255,255,255,0.2)' : 'rgba(255, 90, 54, 0.58)'}
                />
              </Animated.View>
            </Pressable>
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
  topBar: {
    position: 'absolute',
    top: tokens.space[20],
    left: tokens.space[16],
    right: tokens.space[16],
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[12],
  },
  statusRail: {
    position: 'absolute',
    top: 72,
    left: tokens.space[16],
    right: tokens.space[16],
    zIndex: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.space[8],
    flexWrap: 'wrap',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[8],
    paddingHorizontal: tokens.space[12],
    paddingVertical: tokens.space[8],
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillLive: {
    backgroundColor: 'rgba(255, 90, 54, 0.14)',
    borderColor: 'rgba(255, 90, 54, 0.28)',
  },
  statusPillMuted: {
    backgroundColor: 'rgba(17,17,17,0.06)',
    borderColor: 'rgba(17,17,17,0.08)',
  },
  statusPillDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  statusPillDotLive: {
    backgroundColor: tokens.color.brand,
  },
  statusPillDotMuted: {
    backgroundColor: 'rgba(17,17,17,0.42)',
  },
  statusPillText: {
    fontSize: tokens.font.size[12],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.text,
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
  chromeButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: tokens.color.textFaint,
  },
  chromeButtonActive: {
    backgroundColor: tokens.color.brand,
    borderColor: tokens.color.brand,
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
    paddingHorizontal: tokens.space[16],
    paddingVertical: tokens.space[8],
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 54, 0.08)',
  },
  captureContextTitle: {
    fontSize: tokens.font.size[12],
    color: tokens.color.textMuted,
    fontWeight: tokens.font.weight.medium,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  replayPill: {
    marginTop: tokens.space[12],
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space[8],
    paddingHorizontal: tokens.space[16],
    paddingVertical: tokens.space[8],
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.84)',
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 54, 0.12)',
  },
  replayPillPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.985 }],
  },
  replayPillText: {
    fontSize: tokens.font.size[12],
    color: tokens.color.text,
    fontWeight: tokens.font.weight.medium,
    letterSpacing: 0.2,
  },
  promptContextCard: {
    marginTop: tokens.space[12],
    maxWidth: '86%',
    paddingHorizontal: tokens.space[16],
    paddingVertical: tokens.space[12],
    borderRadius: tokens.radius[16],
    backgroundColor: 'rgba(255,255,255,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(255, 90, 54, 0.1)',
    gap: tokens.space[4],
  },
  promptContextEyebrow: {
    fontSize: tokens.font.size[10],
    fontWeight: tokens.font.weight.bold,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: tokens.color.textFaint,
    textAlign: 'center',
  },
  promptContextTitle: {
    fontSize: tokens.font.size[14],
    lineHeight: 20,
    fontWeight: tokens.font.weight.medium,
    color: tokens.color.text,
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
  micTapTargetPressed: {
    transform: [{ scale: 0.985 }],
  },
  micTapTargetDisabled: {
    opacity: 0.6,
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
  discardButtonPressed: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderColor: tokens.color.textFaint,
  },
  discardButtonDisabled: {
    opacity: 0.58,
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
  finishRingDisabled: {
    opacity: 0.7,
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
  finishButtonPressed: {
    opacity: 0.96,
  },
  finishText: {
    fontSize: tokens.font.size[14],
    fontWeight: tokens.font.weight.semibold,
    color: tokens.color.surface,
  },
});
