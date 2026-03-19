function truncateOneLine(raw: string, maxLen: number): string {
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.slice(0, Math.max(0, maxLen - 1)).trimEnd() + '…';
}

function formatInsightStamp(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function makeInstantRecordingTitle(args?: { startedAt?: number; promptLabel?: string }): string {
  const promptLabel = args?.promptLabel?.trim();
  if (promptLabel) return `Insight — ${truncateOneLine(promptLabel, 42)}`;
  return `Insight • ${formatInsightStamp(args?.startedAt ?? Date.now())}`;
}
