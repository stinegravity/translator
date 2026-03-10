export interface RequestMetric {
  id: string;
  path: string;
  method: string;
  status: number;
  durationMs: number;
  startedAt: string;
}

export interface PerfSnapshot {
  authResolvedMs: number | null;
  usageLoadedMs: number | null;
  appReadyMs: number | null;
  firstPaintMs: number | null;
  firstContentfulPaintMs: number | null;
  requests: RequestMetric[];
}

const listeners = new Set<() => void>();

const snapshot: PerfSnapshot = {
  authResolvedMs: null,
  usageLoadedMs: null,
  appReadyMs: null,
  firstPaintMs: null,
  firstContentfulPaintMs: null,
  requests: [],
};

function emit() {
  listeners.forEach((listener) => listener());
}

function setPaintMetric(name: 'first-paint' | 'first-contentful-paint', value: number) {
  if (name === 'first-paint' && snapshot.firstPaintMs === null) {
    snapshot.firstPaintMs = value;
    emit();
  }

  if (name === 'first-contentful-paint' && snapshot.firstContentfulPaintMs === null) {
    snapshot.firstContentfulPaintMs = value;
    emit();
  }
}

if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'paint' && (entry.name === 'first-paint' || entry.name === 'first-contentful-paint')) {
          setPaintMetric(entry.name, entry.startTime);
        }
      }
    });
    observer.observe({ type: 'paint', buffered: true });
  } catch {
    // Ignore unsupported paint observation.
  }
}

export const perfMetrics = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getSnapshot() {
    return snapshot;
  },

  markAuthResolved() {
    if (snapshot.authResolvedMs === null) {
      snapshot.authResolvedMs = performance.now();
      emit();
    }
  },

  markUsageLoaded() {
    snapshot.usageLoadedMs = performance.now();
    emit();
  },

  markAppReady() {
    if (snapshot.appReadyMs === null) {
      snapshot.appReadyMs = performance.now();
      emit();
    }
  },

  recordRequest(metric: Omit<RequestMetric, 'id' | 'startedAt'>) {
    snapshot.requests = [
      {
        ...metric,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        startedAt: new Date().toISOString(),
      },
      ...snapshot.requests,
    ].slice(0, 25);
    emit();
  },
};
