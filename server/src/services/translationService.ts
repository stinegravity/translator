import fetch from 'node-fetch';
import OpenAI from 'openai';
import { cacheService } from './cacheService';
import { translationRepository } from '../repositories/translationRepository';
import { analyticsRepository } from '../repositories/analyticsRepository';
import { logger } from '../infrastructure/logger';
import { withRetry } from '../infrastructure/retry';
import { languages, getLanguageName } from '../infrastructure/languages';

interface GoogleTranslateResponse {
  data: {
    translations: Array<{
      translatedText: string;
    }>;
  };
}

export class TranslationService {
  async translateText(
    text: string,
    target: string,
    source?: string,
    context: string = 'Casual',
    dialect: string = 'Asante Twi'
  ): Promise<string> {
    const cacheKey = cacheService.generateKey('translate', source || 'auto', target, text, context);
    const cached = await cacheService.get<string>(cacheKey);

    if (cached) return cached;

    let translatedText: string;

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey && (context !== 'Casual' || target === 'tw' || source === 'tw')) {
      translatedText = await this.translateWithAI(text, target, source, context, dialect);
    } else {
      translatedText = await this.translateWithGoogle(text, target, source);
    }

    await cacheService.set(cacheKey, translatedText);
    return translatedText;
  }

  async translate(
    text: string,
    target: string,
    source?: string,
    context: string = 'Casual',
    userId?: string,
    folderId?: string,
    dialect: string = 'Asante Twi',
    conversationId?: string
  ): Promise<{ translated: string; historyId?: string }> {
    const translatedText = await this.translateText(text, target, source, context, dialect);
    
    const history = await translationRepository.saveHistory({
      userId,
      folderId,
      conversationId,
      source: source || 'auto',
      target,
      input: text,
      output: translatedText,
      mode: 'text',
    }).catch((e) => {
      logger.error({ err: e }, 'Save history failed');
      return null;
    });

    analyticsRepository.track({ eventType: 'translation', userId, metadata: { source, target, folderId } }).catch((e) => logger.warn({ err: e }, 'Analytics track failed'));

    if (conversationId) {
      translationRepository.touchConversation(conversationId).catch((e) => logger.warn({ err: e }, 'Conversation touch failed'));
    }

    return {
      translated: translatedText,
      historyId: history?.id,
    };
  }


  private async translateWithAI(text: string, target: string, source: string | undefined, context: string, dialect = 'Asante Twi'): Promise<string> {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const targetProfile = languages[target];
    const targetName = getLanguageName(target);

    let systemContent = `You are a professional translator. 
    Your goal is to provide accurate, natural-sounding translations into ${targetName} while strictly adhering to the ${context} tone. 
    Maintain all numbers, dates, and proper names exactly as they appear. 
    Do not repeat yourself or enter into a loop.`;

    if (targetProfile?.systemInstructions) {
      systemContent = targetProfile.systemInstructions(dialect, targetName, context);
    }

    const response = await withRetry(() =>
      openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { 
            role: "system", 
            content: systemContent 
          },
          { 
            role: "user", 
            content: `Translate the following text into ${targetName}${source ? ` (from ${getLanguageName(source)})` : ''}.\n\nText to translate:\n"""\n${text}\n"""` 
          }
        ],
        temperature: 0.3,
        frequency_penalty: 0.5,
      })
    );

    return response.choices[0].message.content?.trim() || text;
  }

  private async translateWithGoogle(text: string, target: string, source?: string): Promise<string> {
    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_TRANSLATE_API_KEY is not set');

    const params = new URLSearchParams({ key: apiKey });
    const body = { q: [text], target, ...(source && { source }) };

    const translatedText = await withRetry(async () => {
      const res = await fetch(`https://translation.googleapis.com/language/translate/v2?${params}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.text();
        const e = new Error(err || 'Translation failed') as Error & { status?: number };
        e.status = res.status;
        throw e;
      }

      const json = (await res.json()) as GoogleTranslateResponse;
      return json.data.translations[0].translatedText;
    });

    return translatedText;
  }
}

export const translationService = new TranslationService();
