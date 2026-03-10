import OpenAI from 'openai';
import { analyticsRepository } from '../repositories/analyticsRepository';
import { withRetry } from '../infrastructure/retry';

export class SpeakerService {
  async textToSpeech(text: string, userId?: string): Promise<Buffer> {
    // Redis might store Buffer as an object or hex, let's be careful.
    // For now, let's skip buffer caching in Redis until we have a proper strategy.
    
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set');

    const openai = new OpenAI({ apiKey });
    
    const mp3 = await withRetry(() =>
      openai.audio.speech.create({
        model: "tts-1",
        voice: "alloy",
        input: text,
      })
    );

    const buffer = Buffer.from(await mp3.arrayBuffer());
    analyticsRepository.track({ eventType: 'tts', userId }).catch(() => {});
    return buffer;
  }
}

export const speakerService = new SpeakerService();
