import { useCallback, useRef, useState } from 'react';

export function useToast(defaultDuration = 2000) {
  const [message, setMessage] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const show = useCallback((text: string, duration = defaultDuration) => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    setMessage(text);
    timeoutRef.current = window.setTimeout(() => {
      setMessage(null);
      timeoutRef.current = null;
    }, duration);
  }, [defaultDuration]);

  const dismiss = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setMessage(null);
  }, []);

  return { message, show, dismiss };
}
