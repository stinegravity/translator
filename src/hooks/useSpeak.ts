import { useState, useRef, useEffect } from 'react';
import { api } from '../api/client';

export function useSpeak() {
  const [loading, setLoading] = useState(false);
  const [activeText, setActiveText] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const revokeUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      revokeUrl();
    };
  }, []);

  const stop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setActiveText(null);
    setIsPlaying(false);
  };

  const speak = async (text: string) => {
    if (!text.trim()) return;

    if (activeText === text && audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play().catch(console.error);
        setIsPlaying(true);
      } else {
        audioRef.current.pause();
        setIsPlaying(false);
      }
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    revokeUrl();

    setLoading(true);
    setError(null);
    setActiveText(text);

    try {
      const res = await api.speak(text);
      if (res.status === 401) {
        window.dispatchEvent(new CustomEvent('auth:expired'));
        throw new Error('Session expired — please sign in again');
      }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Speech failed');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.addEventListener('play', () => setIsPlaying(true));
      audio.addEventListener('pause', () => setIsPlaying(false));

      const cleanup = () => {
        revokeUrl();
        setActiveText(null);
        setIsPlaying(false);
      };

      audio.addEventListener('ended', cleanup, { once: true });
      audio.addEventListener('error', cleanup, { once: true });

      await audio.play();
    } catch (err) {
      revokeUrl();
      setError(err instanceof Error ? err.message : 'Speech failed');
      setActiveText(null);
      setIsPlaying(false);
    } finally {
      setLoading(false);
    }
  };

  return { speak, stop, activeText, isPlaying, loading, error };
}
