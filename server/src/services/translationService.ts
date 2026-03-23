import fetch from 'node-fetch';
import OpenAI from 'openai';
import { cacheService } from './cacheService';
import { translationRepository } from '../repositories/translationRepository';
import { analyticsRepository } from '../repositories/analyticsRepository';
import { logger } from '../infrastructure/logger';
import { withRetry } from '../infrastructure/retry';
import { languages, getLanguageName } from '../infrastructure/languages';
import { isTierAtLeast, type TierName } from '../config/tiers';
import { modelConfigService } from './modelConfigService';

function sanitizeForPrompt(text: string, maxLen = 50_000): string {
  return text
    .replace(/[\x00-\x1F\x7F]/g, '')
    .trim()
    .slice(0, maxLen);
}

const ALLOWED_DIALECTS = new Set([
  'Asante Twi', 'Akuapem Twi', 'Fante', 'Akyem Twi', 'Bono',
  'General Twi',
]);

const ALLOWED_CONTEXTS = new Set([
  'Casual', 'Formal', 'Business', 'Medical', 'News',
  'Legal', 'Technical', 'Religious',
]);

function sanitizeDialect(dialect: string): string {
  const trimmed = dialect.trim();
  return ALLOWED_DIALECTS.has(trimmed) ? trimmed : 'Asante Twi';
}

function sanitizeContext(context: string): string {
  const trimmed = context.trim();
  return ALLOWED_CONTEXTS.has(trimmed) ? trimmed : 'Casual';
}

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
    dialect: string = 'Asante Twi',
    tier: TierName = 'FREE'
  ): Promise<string> {
    const safeText = sanitizeForPrompt(text);
    const safeContext = sanitizeContext(context);
    const safeDialect = sanitizeDialect(dialect);
    const cacheKey = cacheService.generateKey('translate', source || 'auto', target, safeText, safeContext);
    const translationCacheDays = 30;
    const cacheTtl = 3600 * 24 * translationCacheDays;

    return cacheService.getOrCompute(cacheKey, async () => {
      const apiKey = process.env.OPENAI_API_KEY;
      const useGPTForTwiOrContext = safeContext !== 'Casual' || target === 'tw' || source === 'tw';
      const canUseGPT = apiKey && useGPTForTwiOrContext && isTierAtLeast(tier, 'PRO');

      if (canUseGPT) {
        const models = await modelConfigService.getModels();
        return this.translateWithAI(safeText, target, source, safeContext, safeDialect, models.OPENAI_TRANSLATION_MODEL);
      }
      return this.translateWithGoogle(safeText, target, source);
    }, cacheTtl);
  }

  async translateBatch(
    texts: string[],
    target: string,
    source?: string,
    context: string = 'Casual',
    dialect: string = 'Asante Twi',
    tier: TierName = 'FREE'
  ): Promise<string[]> {
    if (texts.length === 0) return [];
    const safeTexts = texts.map((t) => sanitizeForPrompt(t));
    const safeContext = sanitizeContext(context);
    const safeDialect = sanitizeDialect(dialect);
    const results: string[] = new Array(safeTexts.length);
    const uncachedIndices: number[] = [];
    const uncachedTexts: string[] = [];

    for (let i = 0; i < safeTexts.length; i++) {
      const text = safeTexts[i];
      if (!text.trim()) {
        results[i] = '';
        continue;
      }
      const cacheKey = cacheService.generateKey('translate', source || 'auto', target, text, safeContext);
      const cached = await cacheService.get<string>(cacheKey);
      if (cached !== null) {
        results[i] = cached;
      } else {
        uncachedIndices.push(i);
        uncachedTexts.push(text);
      }
    }

    if (uncachedTexts.length > 0) {
      const apiKey = process.env.OPENAI_API_KEY;
      const useGPTForTwiOrContext = safeContext !== 'Casual' || target === 'tw' || source === 'tw';
      const canUseGPT = apiKey && useGPTForTwiOrContext && isTierAtLeast(tier, 'PRO');

      const models = canUseGPT ? await modelConfigService.getModels() : null;
      const translations = canUseGPT
        ? await this.translateBatchWithAI(uncachedTexts, target, source, safeContext, safeDialect, models!.OPENAI_TRANSLATION_MODEL)
        : await this.translateBatchWithGoogle(uncachedTexts, target, source);

      const translationCacheDays = 30;
      const ttl = 3600 * 24 * translationCacheDays;
      for (let j = 0; j < uncachedIndices.length; j++) {
        const idx = uncachedIndices[j];
        const text = uncachedTexts[j];
        const translated = translations[j] ?? '';
        results[idx] = translated;
        const cacheKey = cacheService.generateKey('translate', source || 'auto', target, text, safeContext);
        cacheService.set(cacheKey, translated, ttl).catch(() => {});
      }
    }

    return results;
  }

  async translate(
    text: string,
    target: string,
    source?: string,
    context: string = 'Casual',
    userId?: string,
    folderId?: string,
    dialect: string = 'Asante Twi',
    conversationId?: string,
    tier: TierName = 'FREE'
  ): Promise<{ translated: string; historyId?: string }> {
    const translatedText = await this.translateText(text, target, source, context, dialect, tier);
    
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


  private async translateWithAI(text: string, target: string, source: string | undefined, context: string, dialect = 'Asante Twi', model = 'gpt-4o'): Promise<string> {
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
        model,
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

  private async translateBatchWithAI(
    texts: string[],
    target: string,
    source: string | undefined,
    context: string,
    dialect: string,
    model = 'gpt-4o'
  ): Promise<string[]> {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const targetProfile = languages[target];
    const targetName = getLanguageName(target);

    let systemContent = `You are a professional translator. Translate each segment into ${targetName}. Return a JSON array of translations in the exact same order. No other text. Example: ["trans1","trans2"]`;
    if (targetProfile?.systemInstructions) {
      systemContent = targetProfile.systemInstructions(dialect, targetName, context) +
        '\n\nFor this task: translate each segment. Return a JSON array of translations in the exact same order. No other text. Example: ["trans1","trans2"]';
    }

    const segmentBlock = texts.map((t, i) => `[${i}]: ${t}`).join('\n');
    const userContent = `Translate each segment into ${targetName}${source ? ` (from ${getLanguageName(source)})` : ''}. Output a JSON array only.\n\n${segmentBlock}`;

    const response = await withRetry(() =>
      openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemContent },
          { role: 'user', content: userContent },
        ],
        temperature: 0.3,
        frequency_penalty: 0.5,
      })
    );

    const raw = response.choices[0].message.content?.trim() ?? '[]';
    try {
      const parsed = JSON.parse(raw.replace(/^```json?\s*|\s*```$/g, '')) as unknown;
      const arr = Array.isArray(parsed) ? parsed : [];
      return texts.map((_, i) => (typeof arr[i] === 'string' ? arr[i] : ''));
    } catch {
      logger.warn({ raw }, 'Batch translation JSON parse failed, falling back to per-segment');
      const models = await modelConfigService.getModels();
      return Promise.all(texts.map((t) => this.translateWithAI(t, target, source, context, dialect, models.OPENAI_TRANSLATION_MODEL)));
    }
  }

  private async translateBatchWithGoogle(texts: string[], target: string, source?: string): Promise<string[]> {
    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_TRANSLATE_API_KEY is not set');

    const params = new URLSearchParams({ key: apiKey });
    const body = { q: texts, target, ...(source && { source }) };

    const json = await withRetry(async () => {
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
      return (await res.json()) as GoogleTranslateResponse;
    });

    return json.data.translations.map((t) => t.translatedText);
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
