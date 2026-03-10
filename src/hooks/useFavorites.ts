import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { FavoriteItem } from '../types';

export function useFavorites(enabled: boolean, autoFetch = true) {
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.favorites.list();
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load favorites');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const add = useCallback(async (historyId: string) => {
    await api.favorites.add(historyId);
    await refresh();
  }, [refresh]);

  const remove = useCallback(async (historyId: string) => {
    await api.favorites.remove(historyId);
    setItems((current) => current.filter((item) => item.historyId !== historyId));
  }, []);

  useEffect(() => {
    if (!enabled || !autoFetch) {
      return;
    }

    void refresh();
  }, [autoFetch, enabled, refresh]);

  return { items, loading, error, add, remove, refresh };
}
