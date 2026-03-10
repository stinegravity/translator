import { useState, useCallback } from 'react';
import { api } from '../api/client';
import type { Direction, TranslationResult } from '../types';

export function useTranscribe() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TranslationResult | null>(null);

  const transcribe = useCallback(async (blob: Blob, direction: Direction, diarize = false, folderId?: string, dialect = 'Asante Twi', conversationId?: string) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('audio', blob, blob instanceof File ? blob.name : 'recording.webm');
      formData.append('direction', direction);
      formData.append('dialect', dialect);
      if (diarize) formData.append('diarize', 'true');
      if (folderId) formData.append('folderId', folderId);
      if (conversationId) formData.append('conversationId', conversationId);

      const data = await api.transcribe(formData);
      setResult({
        id: data.historyId,
        transcribed: data.transcribed,
        translated: data.translated,
        source: data.source,
        target: data.target,
        segments: data.segments,
      });
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transcription failed';
      setError(msg.includes('API_KEY') ? `${msg}. Check .env setup.` : msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const transcribeUrl = useCallback(async (url: string, direction: Direction, diarize = false, folderId?: string, dialect = 'Asante Twi', conversationId?: string) => {
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await api.transcribeUrl({
        url,
        direction,
        diarize,
        folderId,
        dialect,
        conversationId,
      });
      setResult({
        id: data.historyId,
        transcribed: data.transcribed,
        translated: data.translated,
        source: data.source,
        target: data.target,
        segments: data.segments,
      });
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transcription failed';
      setError(msg.includes('API_KEY') ? `${msg}. Check .env setup.` : msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setResult(null);
  }, []);

  return { transcribe, transcribeUrl, loading, error, result, reset };
}
