import type { Entry } from '../store/types';

const WORDS_PER_MINUTE = 145;

export function estimateVoiceDurationSecFromTranscript(transcript?: string): number {
  const trimmed = transcript?.trim();
  if (!trimmed) return 0;

  const words = trimmed.split(/\s+/).filter(Boolean).length;
  if (!words) return 0;

  return Math.max(15, Math.round((words / WORDS_PER_MINUTE) * 60));
}

export function getEntryRecordedSeconds(entry: Pick<Entry, 'kind' | 'durationSec' | 'transcript'>): number {
  if (!['voice', 'video', 'import', 'upload'].includes(entry.kind)) return 0;
  if (typeof entry.durationSec === 'number' && Number.isFinite(entry.durationSec) && entry.durationSec > 0) {
    return entry.durationSec;
  }
  return estimateVoiceDurationSecFromTranscript(entry.transcript);
}
