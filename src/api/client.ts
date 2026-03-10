import type { ConversationItem, Direction, ExportItem, FavoriteItem, FolderItem, HealthStatus, HistoryItem, InputMode, TranscriptionSegment, UsageData, UserSettings } from '../types';
import { perfMetrics } from '../lib/perfMetrics';

export const API_BASE = import.meta.env.VITE_API_URL || '';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const startedAt = performance.now();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(!options.body || options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
  });

  if (res.status === 204) {
    return undefined as T;
  }

  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('auth:expired'));
    throw new Error('Session expired — please sign in again');
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }

  perfMetrics.recordRequest({
    path,
    method: options.method || 'GET',
    status: res.status,
    durationMs: performance.now() - startedAt,
  });

  return data as T;
}

export const api = {
  translate: (text: string, direction: Direction, context = 'Casual', folderId?: string, dialect = 'Asante Twi', conversationId?: string) =>
    request<{ translated: string; source: string; target: string; historyId?: string }>('/api/translate', {
      method: 'POST',
      body: JSON.stringify({ text, direction, context, folderId, dialect, conversationId }),
    }),

  transcribe: (formData: FormData) =>
    request<{
      historyId?: string;
      transcribed: string;
      translated: string;
      source: string;
      target: string;
      segments?: TranscriptionSegment[];
    }>('/api/transcribe', {
      method: 'POST',
      body: formData,
    }),

  transcribeUrl: (payload: { url: string; direction: Direction; diarize?: boolean; folderId?: string; dialect?: string; conversationId?: string }) =>
    request<{
      historyId?: string;
      transcribed: string;
      translated: string;
      source: string;
      target: string;
      segments?: TranscriptionSegment[];
    }>('/api/transcribe-url', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  speak: (text: string) =>
    fetch(`${API_BASE}/api/speak`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    }),

  history: (limit = 10) =>
    request<{ items: HistoryItem[] }>(`/api/history?limit=${limit}`),

  archiveHistory: (historyId: string) =>
    request<void>(`/api/history/${historyId}`, { method: 'DELETE' }),

  updateHistoryTranscript: (historyId: string, payload: { transcript: string; context?: string; dialect?: string }) =>
    request<{ item: HistoryItem }>(`/api/history/${historyId}/transcript`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  favorites: {
    list: () => request<{ items: FavoriteItem[] }>('/api/favorites'),
    add: (historyId: string) =>
      request<{ favorite: { id: string; historyId: string; userId: string } }>('/api/favorites', {
        method: 'POST',
        body: JSON.stringify({ historyId }),
      }),
    remove: (historyId: string) =>
      request<void>(`/api/favorites/${historyId}`, { method: 'DELETE' }),
  },

  feedback: {
    submit: (data: {
      historyId: string;
      rating: 1 | 2 | 3;
      correction?: string;
      dialect?: string;
      domain?: string;
      notes?: string;
      source: string;
      aiOutput: string;
    }) =>
      request<{ feedback: { id: string } }>('/api/feedback', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    stats: (dialect?: string) =>
      request<{ stats: { total: number; good: number; ok: number; bad: number; corrected: number } }>(
        dialect ? `/api/feedback-stats?dialect=${encodeURIComponent(dialect)}` : '/api/feedback-stats'
      ),
  },

  folders: {
    list: () => request<{ folders: FolderItem[] }>('/api/folders'),
    create: (name: string) =>
      request<{ folder: FolderItem }>('/api/folders', {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),
    delete: (id: string) =>
      request<void>(`/api/folders/${id}`, { method: 'DELETE' }),
  },

  conversations: {
    list: (folderId?: string) =>
      request<{ items: ConversationItem[] }>(folderId ? `/api/conversations?folderId=${folderId}` : '/api/conversations'),
    create: (title?: string, folderId?: string) =>
      request<{ conversation: ConversationItem }>('/api/conversations', {
        method: 'POST',
        body: JSON.stringify({ title, folderId }),
      }),
    get: (id: string) =>
      request<{ conversation: ConversationItem & { histories: HistoryItem[] } }>(`/api/conversations/${id}`),
    update: (id: string, title: string) =>
      request<{ conversation: ConversationItem }>(`/api/conversations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      }),
    remove: (id: string) =>
      request<void>(`/api/conversations/${id}`, { method: 'DELETE' }),
  },

  exports: {
    list: () => request<{ items: ExportItem[] }>('/api/exports'),
    createHistory: (historyId: string, format: 'txt' | 'srt' | 'vtt') =>
      request<{ export: ExportItem }>(`/api/history/${historyId}/export`, {
        method: 'POST',
        body: JSON.stringify({ format }),
      }),
    createConversation: (conversationId: string) =>
      request<{ export: ExportItem }>(`/api/conversations/${conversationId}/export`, {
        method: 'POST',
        body: JSON.stringify({ format: 'txt' }),
      }),
    download: async (id: string) => {
      const startedAt = performance.now();
      const res = await fetch(`${API_BASE}/api/exports/${id}/download`, {
        credentials: 'include',
      });

      if (res.status === 401) {
        window.dispatchEvent(new CustomEvent('auth:expired'));
        throw new Error('Session expired — please sign in again');
      }

      if (!res.ok) {
        let error = 'Download failed';
        try {
          const data = (await res.json()) as { error?: string };
          error = data.error || error;
        } catch {
          // Keep generic download error if response is not JSON.
        }
        throw new Error(error);
      }

      const blob = await res.blob();
      perfMetrics.recordRequest({
        path: `/api/exports/${id}/download`,
        method: 'GET',
        status: res.status,
        durationMs: performance.now() - startedAt,
      });
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="([^"]+)"/);
      return {
        blob,
        fileName: match?.[1] || `export-${id}`,
      };
    },
  },

  settings: {
    get: () => request<{ settings: UserSettings | null }>('/api/settings'),
    save: (settings: { preferredDirection?: Direction; preferredInputMode?: InputMode; diarizationEnabled?: boolean }) =>
      request<{ settings: UserSettings }>('/api/settings', {
        method: 'POST',
        body: JSON.stringify(settings),
      }),
  },

  usage: () => request<UsageData>('/api/usage'),

  me: () => request<{ user: { id: string; email: string; name: string; tier: string }; usage: UsageData }>('/api/me'),

  health: () => request<HealthStatus>('/api/health'),
};
