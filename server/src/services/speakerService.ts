import crypto from 'crypto';
import OpenAI from 'openai';
import { analyticsRepository } from '../repositories/analyticsRepository';
import { withRetry } from '../infrastructure/retry';
import prisma from '../infrastructure/db';
import redis from '../infrastructure/redis';
import { modelConfigService } from './modelConfigService';

const TTS_CACHE_TTL = 3600 * 24 * 30; // 30 days

export class SpeakerService {
  async textToSpeech(text: string, userId?: string): Promise<Buffer> {
    let voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'nova';
    if (userId) {
      const settings = await prisma.userSettings.findUnique({
        where: { userId },
      });
      const preferred = settings?.preferredVoice;
      if (preferred && ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].includes(preferred)) {
        voice = preferred as typeof voice;
      }
    }

    const cacheKey = `tts:${crypto.createHash('sha256').update(`${voice}:${text}`).digest('hex')}`;
    const cachedBase64 = await redis.get(cacheKey);
    if (cachedBase64) {
      analyticsRepository.track({ eventType: 'tts', userId }).catch(() => {});
      return Buffer.from(cachedBase64, 'base64');
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    const models = await modelConfigService.getModels();
    const openai = new OpenAI({ apiKey, timeout: 60_000 });
    const mp3 = await withRetry(() =>
      openai.audio.speech.create({
        model: models.OPENAI_TTS_MODEL,
        voice,
        input: text,
      })
    );

    const buffer = Buffer.from(await mp3.arrayBuffer());
    await redis.set(cacheKey, buffer.toString('base64'), 'EX', TTS_CACHE_TTL);
    analyticsRepository.track({ eventType: 'tts', userId }).catch(() => {});
    return buffer;
  }
}

export const speakerService = new SpeakerService();
