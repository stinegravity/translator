import type { HistoryItem, TranslationResult, TranscriptionSegment } from '../types';

function sanitizeFileName(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'export';
}

function downloadTextFile(fileName: string, content: string, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(fileName, blob);
}

export function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatSrtTimestamp(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.round((seconds % 1) * 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

function formatVttTimestamp(seconds: number) {
  return formatSrtTimestamp(seconds).replace(',', '.');
}

function getSegmentText(segment: TranscriptionSegment) {
  return segment.translatedText?.trim() || segment.text.trim();
}

function getSegmentsFromResult(result: TranslationResult | HistoryItem) {
  return result.segments?.filter((segment) => getSegmentText(segment)) ?? [];
}

export function exportResultAsText(result: TranslationResult | HistoryItem, label = 'translation') {
  const fileName = `${sanitizeFileName(label)}.txt`;
  const content = [
    `Source language: ${result.source}`,
    `Target language: ${result.target}`,
    result.transcribed ? '' : null,
    result.transcribed ? 'Transcript:' : null,
    result.transcribed ? result.transcribed : null,
    '',
    'Translation:',
    'output' in result ? result.output : result.translated,
  ].filter((line): line is string => line !== null).join('\n');

  downloadTextFile(fileName, content);
}

export function exportResultAsSrt(result: TranslationResult | HistoryItem, label = 'subtitles') {
  const segments = getSegmentsFromResult(result);
  if (segments.length === 0) return;

  const content = segments.map((segment, index) => (
    `${index + 1}\n${formatSrtTimestamp(segment.start)} --> ${formatSrtTimestamp(segment.end)}\n${getSegmentText(segment)}`
  )).join('\n\n');

  downloadTextFile(`${sanitizeFileName(label)}.srt`, content, 'application/x-subrip;charset=utf-8');
}

export function exportResultAsVtt(result: TranslationResult | HistoryItem, label = 'subtitles') {
  const segments = getSegmentsFromResult(result);
  if (segments.length === 0) return;

  const content = [
    'WEBVTT',
    '',
    ...segments.map((segment) => `${formatVttTimestamp(segment.start)} --> ${formatVttTimestamp(segment.end)}\n${getSegmentText(segment)}`),
  ].join('\n\n');

  downloadTextFile(`${sanitizeFileName(label)}.vtt`, content, 'text/vtt;charset=utf-8');
}

export function exportConversationAsText(title: string, items: HistoryItem[]) {
  const content = items.map((item, index) => {
    const timestamp = new Date(item.createdAt).toLocaleString();
    const sourceBlock = item.transcribed ?? item.input;
    return [
      `Turn ${index + 1} - ${timestamp}`,
      `Mode: ${item.mode}`,
      'Source:',
      sourceBlock,
      '',
      'Translation:',
      item.output,
    ].join('\n');
  }).join('\n\n---\n\n');

  downloadTextFile(`${sanitizeFileName(title)}.txt`, content);
}
