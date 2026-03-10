import type { HistoryItemForExport, ConversationForExport } from '../types/export';

interface BuiltExport {
  fileName: string;
  mimeType: string;
  content: Buffer;
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-z0-9-_]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'export';
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

function buildTextContent(item: HistoryItemForExport) {
  return [
    `Source language: ${item.source}`,
    `Target language: ${item.target}`,
    item.transcribed ? '' : null,
    item.transcribed ? 'Transcript:' : null,
    item.transcribed ? item.transcribed : null,
    '',
    'Translation:',
    item.output,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}

function getSegmentText(segment: HistoryItemForExport['segments'][number]) {
  return segment.translatedText?.trim() || segment.text.trim();
}

export class ExportService {
  buildHistoryExport(item: HistoryItemForExport, format: 'txt' | 'srt' | 'vtt'): BuiltExport {
    if (format === 'txt') {
      const content = buildTextContent(item);
      return {
        fileName: `${sanitizeFileName(item.transcribed ? `${item.target}_transcript_translation` : `${item.target}_translation`)}.txt`,
        mimeType: 'text/plain;charset=utf-8',
        content: Buffer.from(content, 'utf-8'),
      };
    }

    const segments = item.segments.filter((segment) => getSegmentText(segment));
    if (segments.length === 0) {
      throw new Error(`Cannot export ${format.toUpperCase()} without transcript segments`);
    }

    if (format === 'srt') {
      const content = segments
        .map(
          (segment, index) =>
            `${index + 1}\n${formatSrtTimestamp(segment.start)} --> ${formatSrtTimestamp(segment.end)}\n${getSegmentText(segment)}`
        )
        .join('\n\n');

      return {
        fileName: `${sanitizeFileName(`${item.target}_subtitles`)}.srt`,
        mimeType: 'application/x-subrip;charset=utf-8',
        content: Buffer.from(content, 'utf-8'),
      };
    }

    const content = [
      'WEBVTT',
      '',
      ...segments.map(
        (segment) => `${formatVttTimestamp(segment.start)} --> ${formatVttTimestamp(segment.end)}\n${getSegmentText(segment)}`
      ),
    ].join('\n\n');

    return {
      fileName: `${sanitizeFileName(`${item.target}_subtitles`)}.vtt`,
      mimeType: 'text/vtt;charset=utf-8',
      content: Buffer.from(content, 'utf-8'),
    };
  }

  buildConversationExport(conversation: ConversationForExport): BuiltExport {
    const content = conversation.histories
      .map((item, index) => {
        const timestamp = new Date(item.createdAt).toLocaleString();
        const sourceBlock = item.transcribed ?? item.input;
        return [`Turn ${index + 1} - ${timestamp}`, `Mode: ${item.mode}`, 'Source:', sourceBlock, '', 'Translation:', item.output].join(
          '\n'
        );
      })
      .join('\n\n---\n\n');

    return {
      fileName: `${sanitizeFileName(conversation.title)}.txt`,
      mimeType: 'text/plain;charset=utf-8',
      content: Buffer.from(content, 'utf-8'),
    };
  }
}

export const exportService = new ExportService();
