import { describe, it, expect } from 'vitest';
import { ExportService } from '../server/src/services/exportService';
import type { HistoryItemForExport, ConversationForExport } from '../server/src/types/export';

const service = new ExportService();

const baseItem: HistoryItemForExport = {
  id: 'test-1',
  source: 'Twi',
  target: 'English',
  input: 'Ete sen',
  output: 'How are you',
  mode: 'text',
  createdAt: new Date('2026-01-01'),
  transcribed: null,
  segments: [],
};

describe('ExportService.buildHistoryExport', () => {
  describe('txt format', () => {
    it('exports text translation without transcript section', () => {
      const result = service.buildHistoryExport({ ...baseItem }, 'txt');
      expect(result.mimeType).toBe('text/plain;charset=utf-8');
      expect(result.fileName).toMatch(/\.txt$/);
      const content = result.content.toString('utf-8');
      expect(content).toContain('Source language: Twi');
      expect(content).toContain('Translation:');
      expect(content).toContain('How are you');
      expect(content).not.toContain('Transcript:');
    });

    it('exports with transcript section when transcribed exists', () => {
      const result = service.buildHistoryExport({ ...baseItem, transcribed: 'Ete sen' }, 'txt');
      const content = result.content.toString('utf-8');
      expect(content).toContain('Transcript:');
      expect(content).toContain('Ete sen');
    });
  });

  describe('srt format', () => {
    it('throws when no segments', () => {
      expect(() => service.buildHistoryExport({ ...baseItem }, 'srt')).toThrow('Cannot export SRT without transcript segments');
    });

    it('generates valid SRT with segments', () => {
      const item: HistoryItemForExport = {
        ...baseItem,
        segments: [
          { start: 0, end: 2.5, text: 'Ete sen', translatedText: 'How are you' },
          { start: 3, end: 5, text: 'Me ho ye', translatedText: 'I am fine' },
        ],
      };
      const result = service.buildHistoryExport(item, 'srt');
      expect(result.fileName).toMatch(/\.srt$/);
      const content = result.content.toString('utf-8');
      expect(content).toContain('1\n00:00:00,000 --> 00:00:02,500\nHow are you');
      expect(content).toContain('2\n00:00:03,000 --> 00:00:05,000\nI am fine');
    });

    it('uses original text when translatedText is empty', () => {
      const item: HistoryItemForExport = {
        ...baseItem,
        segments: [
          { start: 0, end: 1, text: 'Hello', translatedText: '' },
        ],
      };
      const result = service.buildHistoryExport(item, 'srt');
      const content = result.content.toString('utf-8');
      expect(content).toContain('Hello');
    });
  });

  describe('vtt format', () => {
    it('generates valid WebVTT with header', () => {
      const item: HistoryItemForExport = {
        ...baseItem,
        segments: [
          { start: 0, end: 1.5, text: 'test', translatedText: 'test' },
        ],
      };
      const result = service.buildHistoryExport(item, 'vtt');
      expect(result.fileName).toMatch(/\.vtt$/);
      const content = result.content.toString('utf-8');
      expect(content).toMatch(/^WEBVTT/);
      expect(content).toContain('00:00:00.000 --> 00:00:01.500');
    });
  });
});

describe('ExportService.buildConversationExport', () => {
  it('builds multi-turn conversation export', () => {
    const conversation: ConversationForExport = {
      id: 'conv-1',
      title: 'Test Conversation',
      histories: [
        { id: 'h1', createdAt: new Date('2026-01-01T00:00:00Z'), mode: 'text', source: 'en', target: 'tw', input: 'hello', output: 'meema', transcribed: null, segments: [] },
        { id: 'h2', createdAt: new Date('2026-01-01T00:01:00Z'), mode: 'audio', source: 'tw', target: 'en', input: '', output: 'how are you', transcribed: 'Ete sen', segments: [] },
      ],
    };
    const result = service.buildConversationExport(conversation);
    expect(result.fileName).toBe('Test_Conversation.txt');
    const content = result.content.toString('utf-8');
    expect(content).toContain('Turn 1');
    expect(content).toContain('Turn 2');
    expect(content).toContain('Mode: text');
    expect(content).toContain('Mode: audio');
    expect(content).toContain('---');
  });

  it('sanitizes file name', () => {
    const result = service.buildConversationExport({
      id: 'conv-2',
      title: 'Test / Bad <name>',
      histories: [],
    });
    expect(result.fileName).not.toContain('/');
    expect(result.fileName).not.toContain('<');
  });
});
