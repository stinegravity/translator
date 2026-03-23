import { useState, useCallback, useEffect } from 'react';
import { api } from '../api/client';
import type { HistoryItem } from '../types';

export function useHistory(limit = 20, enabled = true, autoFetch = true) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
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
      const fetched = data.items ?? [];
      setItems(fetched);
      setHasMore(fetched.length >= limit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, limit]);

  const loadMore = useCallback(async () => {
    if (!enabled || !hasMore || loading) return;
    setLoading(true);
    try {
      const nextLimit = items.length + limit;
      const data = await api.history(nextLimit);
      const fetched = data.items ?? [];
      setItems(fetched);
      setHasMore(fetched.length >= nextLimit);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more history');
    } finally {
      setLoading(false);
    }
  }, [enabled, hasMore, loading, items.length, limit]);

  useEffect(() => {
    if (!enabled || !autoFetch) {
      return;
    }

    void fetchHistory();
  }, [autoFetch, enabled, fetchHistory]);

  return { items, loading, hasMore, error, refetch: fetchHistory, loadMore };
}
