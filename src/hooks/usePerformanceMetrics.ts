import { useEffect, useState } from 'react';
import { perfMetrics, type PerfSnapshot } from '../lib/perfMetrics';

export function usePerformanceMetrics() {
  const [snapshot, setSnapshot] = useState<PerfSnapshot>(perfMetrics.getSnapshot());

  useEffect(() => {
    const unsubscribe = perfMetrics.subscribe(() => setSnapshot({ ...perfMetrics.getSnapshot() }));
    return () => {
      unsubscribe();
    };
  }, []);

  return snapshot;
}
