import { useState, useCallback, useEffect } from 'react';
import { api } from '../api/client';
import type { HistoryItem } from '../types';

export function useHistory(limit = 10, enabled = true, autoFetch = true) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!enabled) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.history(limit);
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, limit]);

  useEffect(() => {
    if (!enabled || !autoFetch) {
      return;
    }

    void fetchHistory();
  }, [autoFetch, enabled, fetchHistory]);

  return { items, loading, error, refetch: fetchHistory };
}
