import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import type { ConversationItem, HistoryItem } from '../types';

interface ConversationDetail extends ConversationItem {
  histories: HistoryItem[];
}

export function useConversations(folderId?: string, enabled = true, autoFetch = true) {
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [activeConversation, setActiveConversation] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await api.conversations.list(folderId);
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [folderId, enabled]);

  const loadConversation = useCallback(async (id: string) => {
    setDetailLoading(true);
    setError(null);
    try {
      const data = await api.conversations.get(id);
      setActiveConversation(data.conversation);
      return data.conversation;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation');
      setActiveConversation(null);
      return null;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const createConversation = useCallback(async (title?: string) => {
    const data = await api.conversations.create(title, folderId);
    setItems((current) => [data.conversation, ...current.filter((item) => item.id !== data.conversation.id)]);
    return data.conversation;
  }, [folderId]);

  const renameConversation = useCallback(async (id: string, title: string) => {
    const data = await api.conversations.update(id, title);
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...data.conversation } : item)));
    setActiveConversation((current) => (current && current.id === id ? { ...current, title: data.conversation.title } : current));
    return data.conversation;
  }, []);

  const deleteConversation = useCallback(async (id: string) => {
    await api.conversations.remove(id);
    setItems((current) => current.filter((item) => item.id !== id));
    setActiveConversation((current) => (current?.id === id ? null : current));
  }, []);

  const clearActiveConversation = useCallback(() => {
    setActiveConversation(null);
  }, []);

  useEffect(() => {
    if (!enabled || !autoFetch) {
      return;
    }

    void refresh();
  }, [autoFetch, enabled, refresh]);

  useEffect(() => {
    setActiveConversation((current) => {
      if (!current) return null;
      if (folderId && current.folder?.id !== folderId) return null;
      return current;
    });
  }, [folderId]);

  return {
    items,
    activeConversation,
    loading,
    detailLoading,
    error,
    refresh,
    loadConversation,
    createConversation,
    renameConversation,
    deleteConversation,
    clearActiveConversation,
  };
}
