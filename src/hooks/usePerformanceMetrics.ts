import { useEffect, useState } from 'react';
import { perfMetrics, type PerfSnapshot } from '../lib/perfMetrics';

export function usePerformanceMetrics() {
  const [snapshot, setSnapshot] = useState<PerfSnapshot>(perfMetrics.getSnapshot());

  useEffect(() => perfMetrics.subscribe(() => setSnapshot({ ...perfMetrics.getSnapshot() })), []);

  return snapshot;
}
