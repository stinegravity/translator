import { useState } from 'react';
import { api } from '../api/client';

export function useSpeak() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const speak = async (text: string) => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.speak(text);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Speech failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true });
      audio.addEventListener('error', () => URL.revokeObjectURL(url), { once: true });
      await audio.play();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speech failed');
    } finally {
      setLoading(false);
    }
  };

  return { speak, loading, error };
}
