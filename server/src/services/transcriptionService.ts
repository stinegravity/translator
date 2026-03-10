import OpenAI, { toFile } from 'openai';
import { translationService } from './translationService';
import { translationRepository } from '../repositories/translationRepository';
import { storageService } from './storageService';
import { analyticsRepository } from '../repositories/analyticsRepository';
import { logger } from '../infrastructure/logger';
import { withRetry } from '../infrastructure/retry';

interface DiarizedSegment {
  id: string;
  start: number;
  end: number;
  speaker: string;
  text: string;
}

interface DiarizedResponse {
  duration?: number;
  text: string;
  segments?: DiarizedSegment[];
}

export class TranscriptionService {
  async transcribeAndTranslate(
    buffer: Buffer,
    originalName: string,
    mimetype: string,
    direction: string,
    diarize = false,
    userId?: string,
    folderId?: string,
    dialect = 'Asante Twi',
    conversationId?: string
  ) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    const openai = new OpenAI({ apiKey });
    const file = await toFile(buffer, originalName, { type: mimetype });
    const [source, target] = direction.includes('-') ? direction.split('-') : ['en', 'tw'];

    if (diarize) {
      return this.transcribeWithDiarization(openai, file, source, target, buffer, originalName, mimetype, userId, folderId, dialect, conversationId);
    }

    return this.transcribeBasic(openai, file, source, target, buffer, originalName, mimetype, userId, folderId, dialect, conversationId);
  }

  private async transcribeBasic(
    openai: OpenAI,
    file: File,
    source: string,
    target: string,
    buffer: Buffer,
    originalName: string,
    mimetype: string,
    userId?: string,
    folderId?: string,
    dialect = 'Asante Twi',
    conversationId?: string
  ) {
    const transcript = await withRetry(() =>
      openai.audio.transcriptions.create({
        file,
        model: 'whisper-1',
      })
    );

    const transcribedText = (transcript as { text?: string }).text?.trim() ?? '';
    if (!transcribedText) return { transcribed: '', translated: '', source, target };

    const translation = await translationService.translate(transcribedText, target, source, 'Casual', userId, folderId, dialect, conversationId);
    const translatedText = translation.translated;

    const storedFile = await storageService.saveFile(buffer, originalName);
    const audioAsset = await translationRepository.saveAudioAsset({
      userId,
      originalName,
      storedName: storedFile.fileName,
      mimeType: mimetype,
      storagePath: storedFile.filePath,
      sizeBytes: storedFile.sizeBytes,
    });

    const history = await translationRepository.saveHistory({
      userId,
      folderId,
      conversationId,
      audioAssetId: audioAsset.id,
      source,
      target,
      input: transcribedText,
      output: translatedText,
      mode: 'audio',
      transcribed: transcribedText,
    }).catch((e) => {
      logger.error({ err: e }, 'Save history failed');
      return null;
    });

    analyticsRepository.track({ eventType: 'transcription', userId, metadata: { source, target, folderId } }).catch((e) => logger.warn({ err: e }, 'Analytics track failed'));

    if (conversationId) {
      translationRepository.touchConversation(conversationId).catch((e) => logger.warn({ err: e }, 'Conversation touch failed'));
    }

    return { transcribed: transcribedText, translated: translatedText, source, target, historyId: history?.id };
  }

  private async transcribeWithDiarization(
    openai: OpenAI,
    file: File,
    source: string,
    target: string,
    buffer: Buffer,
    originalName: string,
    mimetype: string,
    userId?: string,
    folderId?: string,
    dialect = 'Asante Twi',
    conversationId?: string
  ) {
    const createDiarizedTranscription = openai.audio.transcriptions.create as unknown as (args: {
      file: File;
      model: string;
      response_format: string;
      chunking_strategy: string;
    }) => Promise<unknown>;

    const transcript = await withRetry(() =>
      createDiarizedTranscription({
        file,
        model: 'gpt-4o-transcribe-diarize',
        response_format: 'diarized_json',
        chunking_strategy: 'auto',
      })
    );

    const data = transcript as unknown as DiarizedResponse;
    const segments = data.segments ?? [];
    const transcribedText = data.text?.trim() ?? '';

    if (!transcribedText && segments.length === 0) {
      return { transcribed: '', translated: '', source, target, segments: [] };
    }

    const segmentsWithTranslation = await Promise.all(
      segments.map(async (seg) => {
        const translatedText = seg.text.trim()
          ? (await translationService.translate(seg.text.trim(), target, source, 'Casual', userId, folderId, dialect, conversationId)).translated
          : '';
        return {
          id: seg.id,
          speaker: seg.speaker,
          start: seg.start,
          end: seg.end,
          text: seg.text,
          translatedText,
        };
      })
    );

    const fullTranslated = segmentsWithTranslation
      .map((s) => s.translatedText)
      .filter(Boolean)
      .join(' ');

    const storedFile = await storageService.saveFile(buffer, originalName);
    const audioAsset = await translationRepository.saveAudioAsset({
      userId,
      originalName,
      storedName: storedFile.fileName,
      mimeType: mimetype,
      storagePath: storedFile.filePath,
      sizeBytes: storedFile.sizeBytes,
    });

    const history = await translationRepository.saveHistory({
      userId,
      folderId,
      conversationId,
      audioAssetId: audioAsset.id,
      source,
      target,
      input: transcribedText,
      output: fullTranslated,
      mode: 'audio',
      transcribed: transcribedText,
      segments: segmentsWithTranslation.map((segment) => ({
        speaker: segment.speaker,
        start: segment.start,
        end: segment.end,
        text: segment.text,
        translatedText: segment.translatedText,
      })),
    }).catch((e) => {
      logger.error({ err: e }, 'Save history failed');
      return null;
    });

    analyticsRepository.track({ eventType: 'transcription', userId, metadata: { source, target, diarized: true, folderId } }).catch((e) => logger.warn({ err: e }, 'Analytics track failed'));

    if (conversationId) {
      translationRepository.touchConversation(conversationId).catch((e) => logger.warn({ err: e }, 'Conversation touch failed'));
    }

    return {
      historyId: history?.id,
      transcribed: transcribedText,
      translated: fullTranslated,
      source,
      target,
      segments: segmentsWithTranslation,
    };
  }
}

export const transcriptionService = new TranscriptionService();
