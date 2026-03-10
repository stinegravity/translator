import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { HealthStatus } from '../types';

export function useHealth() {
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.health();
      setStatus(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load health');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 30000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  return { status, loading, error, refresh };
}
