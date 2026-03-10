import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { ExportItem } from '../types';

export function useExports(enabled: boolean, autoFetch = true) {
  const [items, setItems] = useState<ExportItem[]>([]);
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
      const response = await api.exports.list();
      setItems(response.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load exports');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !autoFetch) {
      return;
    }

    void refresh();
  }, [autoFetch, enabled, refresh]);

  return { items, loading, error, refresh };
}
