import { FolderKanban, Heart, RefreshCcw, Sparkles, Waves } from 'lucide-react';
import { useMemo } from 'react';
import { useFavorites } from './hooks/useFavorites';
import { useFolders } from './hooks/useFolders';
import { useHealth } from './hooks/useHealth';
import { useHistory } from './hooks/useHistory';
import { usePerformanceMetrics } from './hooks/usePerformanceMetrics';
import './Portal.css';

interface PortalProps {
  user?: {
    email: string;
    name?: string;
  } | null;
}

export function Portal({ user }: PortalProps) {
  const hasIdentity = !!user;
  const { status, loading, refresh } = useHealth();
  const { items: historyItems } = useHistory(50, hasIdentity);
  const { items: favorites } = useFavorites(hasIdentity);
  const { folders } = useFolders(hasIdentity);
  const performanceMetrics = usePerformanceMetrics();

  const metrics = useMemo(() => {
    const audioCount = historyItems.filter((item) => item.mode === 'audio').length;
    const textCount = historyItems.filter((item) => item.mode === 'text').length;
    return {
      totalHistory: historyItems.length,
      textCount,
      audioCount,
      favorites: favorites.length,
      folders: folders.length,
    };
  }, [favorites.length, folders.length, historyItems]);

  return (
    <>
      <main className="portal-main">
        <section className="portal-bento-grid">
          {/* Bento Card: Identity */}
          <article className="portal-section portal-identity-card">
            <span className="portal-health-label">Linguist Identity</span>
            {hasIdentity ? (
              <div className="portal-identity-content">
                <strong className="portal-identity-name">{user?.name || 'Unnamed profile'}</strong>
                <p className="portal-identity-email">{user?.email}</p>
              </div>
            ) : (
              <p className="portal-empty">No authenticated user detected.</p>
            )}
          </article>

          {/* Bento Card: Saved Library */}
          <article className="portal-section portal-library-card">
            <span className="portal-health-label">Saved Library</span>
            <div className="portal-metric-list">
              <div className="portal-metric-item">
                <Sparkles size={16} color="var(--color-highlight)" /> 
                <span>{metrics.totalHistory} items</span>
              </div>
              <div className="portal-metric-item">
                <Heart size={16} color="#ef4444" /> 
                <span>{metrics.favorites} faves</span>
              </div>
              <div className="portal-metric-item">
                <FolderKanban size={16} color="#eab308" /> 
                <span>{metrics.folders} folders</span>
              </div>
              <div className="portal-metric-item">
                <Waves size={16} color="#3b82f6" /> 
                <span>{metrics.audioCount} audio</span>
              </div>
            </div>
          </article>

          {/* Bento Card: Overall Health */}
          <article className="portal-section portal-health-card-main">
            <div className="portal-section-header">
              <span className="portal-health-label">System Integrity</span>
              <button
                type="button"
                className="portal-mini-refresh"
                onClick={() => void refresh()}
                disabled={loading}
              >
                <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
            {status ? (
              <div className="portal-health-large">
                <strong className={status.ok ? 'status-ok' : 'status-error'}>
                  {status.ok ? 'SYSTEM OPERATIONAL' : 'DEGRADED PERFORMANCE'}
                </strong>
                <p className="portal-timestamp">Last check: {new Date(status.timestamp).toLocaleTimeString()}</p>
              </div>
            ) : (
              <p className="portal-empty">{loading ? 'Scanning...' : 'Awaiting data'}</p>
            )}
          </article>
        </section>

        <section className="portal-section">
          <div className="portal-section-header">
            <h2>Detailed Subsystems</h2>
          </div>
          <div className="portal-subsystems-grid">
            {status?.checks && Object.entries(status.checks).map(([key, value]) => (
              <div key={key} className="portal-health-card">
                <span className="portal-health-label">{key}</span>
                <strong className={value === 'ok' || value === 'ready' ? 'status-ok' : 'status-error'}>
                  {value}
                </strong>
              </div>
            ))}
          </div>
        </section>

        <section className="portal-bento-grid">
          <article className="portal-section portal-stat-slim">
            <span className="portal-health-label">Text Load</span>
            <div className="portal-kpi-row">
              <strong className="portal-kpi-small">{metrics.textCount}</strong>
              <span className="portal-subcopy-mini">entries</span>
            </div>
          </article>
          <article className="portal-section portal-stat-slim">
            <span className="portal-health-label">Audio Load</span>
            <div className="portal-kpi-row">
              <strong className="portal-kpi-small">{metrics.audioCount}</strong>
              <span className="portal-subcopy-mini">jobs</span>
            </div>
          </article>
        </section>





        <section className="portal-section">
          <div className="portal-section-header">
            <h2>Performance</h2>
          </div>
          <div className="portal-health-grid">
            <div className="portal-health-card">
              <span className="portal-health-label">Auth resolved</span>
              <strong>{performanceMetrics.authResolvedMs ? `${Math.round(performanceMetrics.authResolvedMs)} ms` : 'pending'}</strong>
            </div>
            <div className="portal-health-card">
              <span className="portal-health-label">Usage loaded</span>
              <strong>{performanceMetrics.usageLoadedMs ? `${Math.round(performanceMetrics.usageLoadedMs)} ms` : 'deferred'}</strong>
            </div>
            <div className="portal-health-card">
              <span className="portal-health-label">App ready</span>
              <strong>{performanceMetrics.appReadyMs ? `${Math.round(performanceMetrics.appReadyMs)} ms` : 'pending'}</strong>
            </div>
            <div className="portal-health-card">
              <span className="portal-health-label">First paint</span>
              <strong>{performanceMetrics.firstPaintMs ? `${Math.round(performanceMetrics.firstPaintMs)} ms` : 'n/a'}</strong>
            </div>
            <div className="portal-health-card">
              <span className="portal-health-label">First contentful paint</span>
              <strong>{performanceMetrics.firstContentfulPaintMs ? `${Math.round(performanceMetrics.firstContentfulPaintMs)} ms` : 'n/a'}</strong>
            </div>
          </div>

          <div className="portal-section-header portal-subsection-header">
            <h2>Recent API timings</h2>
          </div>
          {performanceMetrics.requests.length === 0 ? (
            <p className="portal-empty">No API calls recorded in this session yet.</p>
          ) : (
            <div className="portal-request-list">
              {performanceMetrics.requests.map((request) => (
                <div key={request.id} className="portal-request-row">
                  <div>
                    <strong>{request.method}</strong> <span>{request.path}</span>
                  </div>
                  <div className="portal-request-meta">
                    <span>{request.status}</span>
                    <span>{Math.round(request.durationMs)} ms</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}
