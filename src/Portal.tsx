import { Activity, ArrowLeft, FolderKanban, Heart, RefreshCcw, Sparkles, Waves } from 'lucide-react';
import { useMemo } from 'react';
import { useFavorites } from './hooks/useFavorites';
import { useFolders } from './hooks/useFolders';
import { useHealth } from './hooks/useHealth';
import { useHistory } from './hooks/useHistory';
import { usePerformanceMetrics } from './hooks/usePerformanceMetrics';
import { useUserProfile } from './hooks/useUserProfile';
import './Portal.css';

export function Portal() {
  const { profile, hasIdentity } = useUserProfile();
  const { status, loading, refresh, error } = useHealth();
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
    <div className="portal-container">
      <header className="portal-header">
        <a href="/" className="portal-back">
          <ArrowLeft size={20} />
          Back to KyereAse
        </a>
        <div className="portal-brand">
          <Activity size={28} color="var(--color-highlight)" />
          <h1>Portal Dashboard</h1>
        </div>
        <p className="portal-subtitle">Operational visibility for KyereAse</p>
      </header>

      <main className="portal-main">
        <section className="portal-grid">
          <article className="portal-section portal-stat-card">
            <span className="portal-health-label">Identity</span>
            {hasIdentity ? (
              <>
                <strong className="portal-identity-name">{profile.name || 'Unnamed profile'}</strong>
                <p className="portal-identity-email">{profile.email}</p>
              </>
            ) : (
              <p className="portal-empty">No local profile configured. Add one in the translator settings.</p>
            )}
          </article>

          <article className="portal-section portal-stat-card">
            <span className="portal-health-label">Saved Library</span>
            <div className="portal-metric-list">
              <div><Sparkles size={15} /> <span>{metrics.totalHistory} history items</span></div>
              <div><Heart size={15} /> <span>{metrics.favorites} favorites</span></div>
              <div><FolderKanban size={15} /> <span>{metrics.folders} folders</span></div>
              <div><Waves size={15} /> <span>{metrics.audioCount} audio entries</span></div>
            </div>
          </article>
        </section>

        <section className="portal-section">
          <div className="portal-section-header">
            <h2>System Health</h2>
            <button
              type="button"
              className="portal-refresh"
              onClick={() => void refresh()}
              disabled={loading}
              title="Refresh"
            >
              <RefreshCcw size={18} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
          <div className="portal-health-grid">
            {error ? <p className="portal-empty">{error}</p> : null}
            {status ? (
              <>
                <div className={`portal-health-badge ${status.ok ? 'ok' : 'error'}`}>
                  <span className="portal-health-label">Overall</span>
                  <strong>{status.ok ? 'Healthy' : 'Degraded'}</strong>
                </div>
                {Object.entries(status.checks).map(([key, value]) => (
                  <div key={key} className="portal-health-card">
                    <span className="portal-health-label">{key}</span>
                    <strong className={value === 'ok' || value === 'ready' ? 'status-ok' : 'status-error'}>
                      {value}
                    </strong>
                  </div>
                ))}
                <p className="portal-timestamp">Last checked: {new Date(status.timestamp).toLocaleString()}</p>
              </>
            ) : (
              <p className="portal-empty">{loading ? 'Loading...' : 'No health data yet.'}</p>
            )}
          </div>
        </section>

        <section className="portal-grid">
          <article className="portal-section portal-stat-card">
            <span className="portal-health-label">Text Volume</span>
            <strong className="portal-kpi">{metrics.textCount}</strong>
            <p className="portal-subcopy">Saved text translations</p>
          </article>
          <article className="portal-section portal-stat-card">
            <span className="portal-health-label">Audio Volume</span>
            <strong className="portal-kpi">{metrics.audioCount}</strong>
            <p className="portal-subcopy">Saved audio transcription jobs</p>
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
    </div>
  );
}
