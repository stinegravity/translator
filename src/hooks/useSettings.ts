import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { UserSettings } from '../types';

export function useSettings(enabled: boolean) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setSettings(null);
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.settings.get();
      setSettings(data.settings);
      return data.settings;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const save = useCallback(async (nextSettings: UserSettings) => {
    if (!enabled) return null;

    setSaving(true);
    setError(null);
    try {
      const data = await api.settings.save(nextSettings);
      setSettings(data.settings);
      return data.settings;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { settings, loading, saving, error, refresh, save };
}
