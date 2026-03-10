import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { FolderItem } from '../types';

export function useFolders(enabled = true, autoFetch = true) {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setFolders([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await api.folders.list();
      setFolders(data.folders ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folders');
      setFolders([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const createFolder = useCallback(async (name: string) => {
    const data = await api.folders.create(name);
    setFolders((current) => [...current, data.folder].sort((a, b) => a.name.localeCompare(b.name)));
    return data.folder;
  }, []);

  const deleteFolder = useCallback(async (id: string) => {
    await api.folders.delete(id);
    setFolders((current) => current.filter((folder) => folder.id !== id));
  }, []);

  useEffect(() => {
    if (!enabled || !autoFetch) {
      return;
    }

    void refresh();
  }, [autoFetch, enabled, refresh]);

  return { folders, loading, error, createFolder, deleteFolder, refresh };
}
