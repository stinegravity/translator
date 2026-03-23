import { describe, it, expect } from 'vitest';
import { schemas } from '../server/src/middleware/validate';

describe('validation schemas', () => {
  describe('translate', () => {
    it('accepts valid input', () => {
      const result = schemas.translate.parse({
        text: 'Hello world',
        direction: 'en-tw',
        dialect: 'Asante Twi',
        context: 'Casual',
      });
      expect(result.text).toBe('Hello world');
      expect(result.dialect).toBe('Asante Twi');
    });

    it('defaults direction to tw-en', () => {
      const result = schemas.translate.parse({ text: 'test' });
      expect(result.direction).toBe('tw-en');
    });

    it('rejects invalid dialect', () => {
      expect(() =>
        schemas.translate.parse({ text: 'test', dialect: 'INJECTED; DROP TABLE' })
      ).toThrow();
    });

    it('rejects invalid context', () => {
      expect(() =>
        schemas.translate.parse({ text: 'test', context: 'malicious prompt' })
      ).toThrow();
    });

    it('rejects empty text', () => {
      expect(() => schemas.translate.parse({ text: '' })).toThrow();
    });

    it('strips control characters from text', () => {
      const result = schemas.translate.parse({ text: 'hello\x00world' });
      expect(result.text).toBe('helloworld');
    });

    it('accepts all valid dialects', () => {
      for (const dialect of ['Asante Twi', 'Akuapem Twi', 'Fante', 'Akyem Twi', 'Bono', 'General Twi']) {
        expect(() => schemas.translate.parse({ text: 'test', dialect })).not.toThrow();
      }
    });

    it('accepts all valid contexts', () => {
      for (const context of ['Casual', 'Formal', 'Business', 'Medical', 'News', 'Legal', 'Technical', 'Religious']) {
        expect(() => schemas.translate.parse({ text: 'test', context })).not.toThrow();
      }
    });
  });

  describe('transcribe', () => {
    it('coerces string diarize to boolean', () => {
      const result = schemas.transcribe.parse({ diarize: 'true' });
      expect(result.diarize).toBe(true);
    });

    it('defaults diarize to false', () => {
      const result = schemas.transcribe.parse({});
      expect(result.diarize).toBe(false);
    });

    it('accepts valid dialect', () => {
      const result = schemas.transcribe.parse({ dialect: 'Fante' });
      expect(result.dialect).toBe('Fante');
    });
  });

  describe('transcribeUrl', () => {
    it('accepts valid YouTube URL', () => {
      const result = schemas.transcribeUrl.parse({
        url: 'https://www.youtube.com/watch?v=abc123',
      });
      expect(result.url).toBe('https://www.youtube.com/watch?v=abc123');
    });

    it('rejects non-URL strings', () => {
      expect(() => schemas.transcribeUrl.parse({ url: 'not a url' })).toThrow();
    });
  });

  describe('saveSettings', () => {
    it('accepts all valid voices', () => {
      for (const voice of ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']) {
        expect(() => schemas.saveSettings.parse({ preferredVoice: voice })).not.toThrow();
      }
    });

    it('rejects invalid voice', () => {
      expect(() => schemas.saveSettings.parse({ preferredVoice: 'unknown' })).toThrow();
    });

    it('accepts valid input modes', () => {
      expect(schemas.saveSettings.parse({ preferredInputMode: 'text' }).preferredInputMode).toBe('text');
      expect(schemas.saveSettings.parse({ preferredInputMode: 'audio' }).preferredInputMode).toBe('audio');
    });
  });

  describe('createHistoryExport', () => {
    it('accepts txt, srt, vtt', () => {
      expect(schemas.createHistoryExport.parse({ format: 'txt' }).format).toBe('txt');
      expect(schemas.createHistoryExport.parse({ format: 'srt' }).format).toBe('srt');
      expect(schemas.createHistoryExport.parse({ format: 'vtt' }).format).toBe('vtt');
    });

    it('rejects invalid format', () => {
      expect(() => schemas.createHistoryExport.parse({ format: 'pdf' })).toThrow();
    });
  });

  describe('submitAppFeedback', () => {
    it('accepts valid ratings', () => {
      const result = schemas.submitAppFeedback.parse({
        overallRating: 5,
        performanceRating: 4,
        reliabilityRating: 3,
        easeRating: 2,
      });
      expect(result.overallRating).toBe(5);
    });

    it('rejects rating out of range', () => {
      expect(() =>
        schemas.submitAppFeedback.parse({
          overallRating: 6,
          performanceRating: 4,
          reliabilityRating: 3,
          easeRating: 2,
        })
      ).toThrow();
    });
  });

  describe('updateInternalUser', () => {
    it('accepts valid internal roles', () => {
      expect(schemas.updateInternalUser.parse({ internalRole: 'ADMIN' }).internalRole).toBe('ADMIN');
      expect(schemas.updateInternalUser.parse({ internalRole: 'OPS' }).internalRole).toBe('OPS');
      expect(schemas.updateInternalUser.parse({ internalRole: 'CUSTOMER' }).internalRole).toBe('CUSTOMER');
    });

    it('rejects invalid role', () => {
      expect(() => schemas.updateInternalUser.parse({ internalRole: 'SUPERADMIN' })).toThrow();
    });
  });
});
