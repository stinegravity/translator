import { useState, useCallback } from 'react';
import { api } from '../api/client';
import type { Direction, TranslationResult } from '../types';

export function useTranslate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranslationResult | null>(null);

  const translate = useCallback(async (text: string, direction: Direction, context: string = 'Casual', folderId?: string, dialect = 'Asante Twi', conversationId?: string) => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.translate(text, direction, context, folderId, dialect, conversationId);
      setResult({
        id: data.historyId,
        translated: data.translated,
        source: data.source,
        target: data.target,
      });
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Translation failed';
      setError(msg.includes('API_KEY') ? `${msg}. Check .env setup.` : msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  return { translate, loading, error, result, reset };
}
