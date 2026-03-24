import OpenAI, { toFile } from 'openai';
import { translationService } from './translationService';
import { translationRepository } from '../repositories/translationRepository';
import { storageService } from './storageService';
import { analyticsRepository } from '../repositories/analyticsRepository';
import { logger } from '../infrastructure/logger';
import { withRetry } from '../infrastructure/retry';
import type { TierName } from '../config/tiers';
import { modelConfigService } from './modelConfigService';

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
    conversationId?: string,
    tier: TierName = 'FREE'
  ) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    const openai = new OpenAI({ apiKey, timeout: 120_000 });
    const file = await toFile(buffer, originalName, { type: mimetype });
    const [source, target] = direction.includes('-') ? direction.split('-') : ['en', 'tw'];

    if (diarize) {
      return this.transcribeWithDiarization(openai, file, source, target, buffer, originalName, mimetype, userId, folderId, dialect, conversationId, tier);
    }

    return this.transcribeBasic(openai, file, source, target, buffer, originalName, mimetype, userId, folderId, dialect, conversationId, tier);
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
    conversationId?: string,
    tier: TierName = 'FREE'
  ) {
    const models = await modelConfigService.getModels();
    const transcript = await withRetry(() =>
      openai.audio.transcriptions.create({
        file,
        model: models.OPENAI_TRANSCRIPTION_MODEL,
      })
    );

    const transcribedText = (transcript as { text?: string }).text?.trim() ?? '';
    if (!transcribedText) return { transcribed: '', translated: '', source, target };

    const translation = await translationService.translate(transcribedText, target, source, 'Casual', userId, folderId, dialect, conversationId, tier);
    const translatedText = translation.translated;

    return this.persistTranscriptionResult({
      buffer,
      originalName,
      mimetype,
      source,
      target,
      transcribedText,
      translatedText,
      userId,
      folderId,
      conversationId,
      diarized: false,
    });
  }

  private async persistTranscriptionResult(params: {
    buffer: Buffer;
    originalName: string;
    mimetype: string;
    source: string;
    target: string;
    transcribedText: string;
    translatedText: string;
    userId?: string;
    folderId?: string;
    conversationId?: string;
    diarized: boolean;
    segments?: Array<{ speaker: string; start: number; end: number; text: string; translatedText: string }>;
  }) {
    const { buffer, originalName, mimetype, source, target, transcribedText, translatedText, userId, folderId, conversationId, diarized, segments } = params;

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
      ...(segments && { segments }),
    }).catch((e) => {
      logger.error({ err: e }, 'Save history failed');
      return null;
    });

    analyticsRepository.track({
      eventType: 'transcription',
      userId,
      metadata: { source, target, diarized, folderId },
    }).catch((e) => logger.warn({ err: e }, 'Analytics track failed'));

    if (conversationId) {
      translationRepository.touchConversation(conversationId).catch((e) => logger.warn({ err: e }, 'Conversation touch failed'));
    }

    return {
      transcribed: transcribedText,
      translated: translatedText,
      source,
      target,
      historyId: history?.id,
      ...(segments && { segments }),
    };
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
    conversationId?: string,
    tier: TierName = 'FREE'
  ) {
    const models = await modelConfigService.getModels();
    const transcript = await withRetry(() =>
      openai.audio.transcriptions.create({
        file,
        model: models.OPENAI_TRANSCRIPTION_DIARIZE_MODEL,
        response_format: 'diarized_json',
        chunking_strategy: 'auto',
      } as Parameters<typeof openai.audio.transcriptions.create>[0])
    );

    const data = transcript as unknown as DiarizedResponse;
    const segments = data.segments ?? [];
    const transcribedText = data.text?.trim() ?? '';

    if (!transcribedText && segments.length === 0) {
      return { transcribed: '', translated: '', source, target, segments: [] };
    }

    const textsToTranslate = segments.map((seg) => seg.text.trim());
    const translations = await translationService.translateBatch(
      textsToTranslate,
      target,
      source,
      'Casual',
      dialect,
      tier
    );

    const segmentsWithTranslation = segments.map((seg, i) => ({
      id: seg.id,
      speaker: seg.speaker,
      start: seg.start,
      end: seg.end,
      text: seg.text,
      translatedText: seg.text.trim() ? (translations[i] ?? '') : '',
    }));

    const fullTranslated = segmentsWithTranslation
      .map((s) => s.translatedText)
      .filter(Boolean)
      .join(' ');

    return this.persistTranscriptionResult({
      buffer,
      originalName,
      mimetype,
      source,
      target,
      transcribedText,
      translatedText: fullTranslated,
      userId,
      folderId,
      conversationId,
      diarized: true,
      segments: segmentsWithTranslation.map((s) => ({
        speaker: s.speaker,
        start: s.start,
        end: s.end,
        text: s.text,
        translatedText: s.translatedText,
      })),
    }).then((result) => ({
      ...result,
      segments: segmentsWithTranslation,
    }));
  }
}

export const transcriptionService = new TranscriptionService();
