import type { AppFeedbackItem, ConversationItem, Direction, ExportItem, FavoriteItem, FolderItem, HealthStatus, HistoryItem, InputMode, InternalRole, InternalUserItem, ReviewerAccessStatus, ReviewerApplicationItem, TranscriptionSegment, UsageData, UserSettings } from '../types';
import { perfMetrics } from '../lib/perfMetrics';

export const API_BASE = import.meta.env.VITE_API_URL || '';

/** Polling interval for transcription job status (ms) */
const POLL_INTERVAL_MS = 2000;
/** Maximum polling attempts before timeout (6 minutes at 2s intervals) */
const MAX_POLL_ATTEMPTS = 180;

// Track in-flight AbortControllers for deduplication
const inflightControllers = new Map<string, AbortController>();

/**
 * Cancel any in-flight request for the given key and return a fresh AbortSignal.
 * Used to prevent duplicate requests when users rapidly trigger the same action.
 */
function dedup(key: string): AbortSignal {
  inflightControllers.get(key)?.abort();
  const controller = new AbortController();
  inflightControllers.set(key, controller);
  controller.signal.addEventListener('abort', () => {
    if (inflightControllers.get(key) === controller) {
      inflightControllers.delete(key);
    }
  });
  return controller.signal;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const startedAt = performance.now();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'X-Requested-With': 'KyereAse',
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
  if (res.status === 413) {
    throw new Error('File too large — try a shorter recording or smaller file (max 25MB)');
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error(res.ok ? 'Invalid response' : `Request failed (${res.status})`);
  }
  if (!res.ok) {
    throw new Error((data as { error?: string })?.error || 'Request failed');
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
      signal: dedup('translate'),
    }),

  transcribe: async (
    formData: FormData,
    onProgress?: (status: string) => void
  ): Promise<{
    historyId?: string;
    transcribed: string;
    translated: string;
    source: string;
    target: string;
    segments?: TranscriptionSegment[];
  }> => {
    const data = await request<{ jobId?: string; status?: string; error?: string }>('/api/transcribe', {
      method: 'POST',
      body: formData,
    });
    if (!data.jobId) throw new Error('Unexpected response');
    onProgress?.('processing');
    return api.pollTranscriptionJob(data.jobId, onProgress);
  },

  pollTranscriptionJob: async (
    jobId: string,
    onProgress?: (status: string) => void
  ): Promise<{
    historyId?: string;
    transcribed: string;
    translated: string;
    source: string;
    target: string;
    segments?: TranscriptionSegment[];
  }> => {
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      const result = await request<{
        jobId: string;
        status: string;
        transcribed?: string;
        translated?: string;
        source?: string;
        target?: string;
        historyId?: string;
        segments?: TranscriptionSegment[];
        error?: string;
      }>(`/api/transcribe/${jobId}`);
      if (result.status === 'completed' && result.transcribed !== undefined) {
        return {
          historyId: result.historyId,
          transcribed: result.transcribed,
          translated: result.translated ?? '',
          source: result.source ?? '',
          target: result.target ?? '',
          segments: result.segments,
        };
      }
      if (result.status === 'failed' && result.error) {
        throw new Error(result.error);
      }
      onProgress?.('processing');
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }
    throw new Error('Transcription timed out');
  },

  transcribeUrl: async (
    payload: { url: string; direction: Direction; diarize?: boolean; folderId?: string; dialect?: string; conversationId?: string },
    onProgress?: (status: string) => void
  ): Promise<{
    historyId?: string;
    transcribed: string;
    translated: string;
    source: string;
    target: string;
    segments?: TranscriptionSegment[];
  }> => {
    const data = await request<{ jobId?: string; status?: string; error?: string }>('/api/transcribe-url', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!data.jobId) throw new Error('Unexpected response');
    onProgress?.('processing');
    return api.pollTranscriptionJob(data.jobId, onProgress);
  },

  speak: async (text: string) => {
    const signal = dedup('speak');
    const res = await fetch(`${API_BASE}/api/speak`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'KyereAse' },
      body: JSON.stringify({ text }),
      signal,
    });
    if (res.status === 401) {
      window.dispatchEvent(new CustomEvent('auth:expired'));
      throw new Error('Session expired — please sign in again');
    }
    return res;
  },

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

  appFeedback: {
    submit: (data: {
      overallRating: number;
      performanceRating: number;
      reliabilityRating: number;
      easeRating: number;
      notes?: string;
      currentPath?: string;
    }) =>
      request<{ feedback: { id: string } }>('/api/app-feedback', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    list: (limit = 50) =>
      request<{ items: AppFeedbackItem[] }>(`/api/app-feedback?limit=${limit}`),
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
    update: (id: string, updates: { title?: string; folderId?: string | null }) =>
      request<{ conversation: ConversationItem }>(`/api/conversations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
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

  me: () =>
    request<{
      user: {
        id: string;
        email: string;
        name: string;
        tier: string;
        portalAccess: boolean;
        internalRole: InternalRole;
        reviewerAccess: boolean;
        reviewerAccessStatus: ReviewerAccessStatus;
      };
      usage: UsageData;
    }>('/api/me'),

  internalUsers: {
    list: () => request<{ items: InternalUserItem[] }>('/api/internal-users'),
    update: (id: string, payload: { internalRole: InternalRole }) =>
      request<{ user: InternalUserItem }>(`/api/internal-users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
  },

  modelConfig: {
    get: () =>
      request<{ items: Array<{ key: string; label: string; value: string; default: string }> }>('/api/model-config'),
    update: (updates: Record<string, string>) =>
      request<{ models: Record<string, string> }>('/api/model-config', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      }),
  },

  reviewerAccess: {
    request: (payload: {
      organization?: string;
      roleTitle?: string;
      languages?: string;
      credentials: string;
      reviewUseCase?: string;
      portfolioUrl?: string;
      notes?: string;
    }) =>
      request<{ application: { id: string } }>('/api/reviewer-access/request', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    listRequests: (status?: 'PENDING' | 'APPROVED' | 'REJECTED', limit = 50) =>
      request<{ items: ReviewerApplicationItem[] }>(
        `/api/reviewer-access/requests?limit=${limit}${status ? `&status=${encodeURIComponent(status)}` : ''}`
      ),
    reviewRequest: (id: string, payload: { status: 'APPROVED' | 'REJECTED'; reviewerDecisionNotes?: string }) =>
      request<{ application: ReviewerApplicationItem }>(`/api/reviewer-access/requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
  },

  health: () => request<HealthStatus>('/api/health'),
};
