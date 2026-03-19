import type { Draft } from '../store/types';

function isPlainProseFormat(format: Draft['format']) {
  return format === 'essay' || format === 'commentary' || format === 'book-chapter';
}

function removeQuestionAppendix(text: string) {
  return text
    .replace(/\n{2,}(?:#{1,6}\s*)?(?:targeted\s+questions\s+for\s+further\s+exploration|questions\s+for\s+further\s+exploration|follow-?up\s+questions)\s*\n[\s\S]*$/i, '')
    .replace(/\n{2,}(?:\*\*|__)?targeted\s+questions(?:\*\*|__)?\s*\n[\s\S]*$/i, '');
}

function stripMarkdownSurface(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^\s*#{1,6}\s*/gm, '')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1$2')
    .replace(/(^|[^_])_([^_]+)_(?!_)/g, '$1$2')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function normalizeDraftContentForFormat(format: Draft['format'], text: string) {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (!isPlainProseFormat(format)) return trimmed;
  return stripMarkdownSurface(removeQuestionAppendix(trimmed));
}

export function normalizeDraftEditorContent(format: Draft['format'], text: string) {
  if (!isPlainProseFormat(format)) return text;
  return normalizeDraftContentForFormat(format, text);
}
