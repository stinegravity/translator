import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { ChevronRight, Download, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface ReviewItem {
  id: string;
  source: string;
  aiOutput: string;
  correction: string | null;
  rating: number;
  dialect: string | null;
  domain: string | null;
  createdAt: string;
  history: {
    id: string;
    input: string;
    target: string;
  };
}

export function ReviewDashboard() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState({ total: 0, good: 0, ok: 0, bad: 0, corrected: 0 });
  const [loading, setLoading] = useState(true);
  const [dialect, setDialect] = useState<string>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Note: We'll need to add these endpoints to our API client or just fetch directly
      const statsData = await api.feedback.stats(dialect === 'all' ? undefined : dialect);
      setStats(statsData.stats);

      const queueResponse = await fetch(`/api/review-queue?${dialect !== 'all' ? `dialect=${dialect}` : ''}`);
      const queueData = await queueResponse.json();
      setItems(queueData.items);
    } catch (err) {
      console.error('Failed to load review data', err);
    } finally {
      setLoading(false);
    }
  }, [dialect]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleExport = () => {
    const url = `/api/feedback/export?${dialect !== 'all' ? `dialect=${dialect}` : ''}`;
    window.open(url, '_blank');
  };

  return (
    <div className="review-dashboard">
      <header className="review-header">
        <h1>Human Review Queue</h1>
        <div className="review-actions">
          <select value={dialect} onChange={(e) => setDialect(e.target.value)} className="review-select">
            <option value="all">All Dialects</option>
            <option value="Asante Twi">Asante Twi</option>
            <option value="Akuapem Twi">Akuapem Twi</option>
            <option value="Fante">Fante</option>
          </select>
          <button onClick={handleExport} className="review-export-btn">
            <Download size={16} />
            Export for Fine-tuning
          </button>
        </div>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-label">Total Rated</span>
          <span className="stat-value">{stats.total}</span>
        </div>
        <div className="stat-card good">
          <span className="stat-label">Good</span>
          <span className="stat-value">{stats.good}</span>
        </div>
        <div className="stat-card ok">
          <span className="stat-label">Needs Polish</span>
          <span className="stat-value">{stats.ok}</span>
        </div>
        <div className="stat-card bad">
          <span className="stat-label">Incorrect</span>
          <span className="stat-value">{stats.bad}</span>
        </div>
        <div className="stat-card accent">
          <span className="stat-label">Human Corrections</span>
          <span className="stat-value">{stats.corrected}</span>
        </div>
      </div>

      <div className="review-list">
        <h2>Review Items (Bad/OK without correction)</h2>
        {loading ? (
          <p className="loading-text">Loading queue...</p>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <CheckCircle size={48} />
            <p>Queue is clear! Great job.</p>
          </div>
        ) : (
          <div className="queue-container">
            {items.map((item) => (
              <motion.div key={item.id} className="queue-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="queue-main">
                  <div className="queue-row">
                    <span className="queue-tag">English</span>
                    <p>{item.source}</p>
                  </div>
                  <div className="queue-row alt">
                    <span className="queue-tag twi">AI Twi</span>
                    <p>{item.aiOutput}</p>
                  </div>
                </div>
                <div className="queue-meta">
                  <div className="queue-info">
                    <span className={`rating-dot ${item.rating === 1 ? 'bad' : 'ok'}`} />
                    <span>{item.dialect || 'General Twi'}</span>
                    <span>•</span>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>
                  <button className="queue-review-btn">
                    Review Correction
                    <ChevronRight size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .review-dashboard {
          padding: 2rem;
          color: var(--color-text);
          max-width: 1000px;
          margin: 0 auto;
        }
        .review-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }
        .review-actions {
          display: flex;
          gap: 1rem;
        }
        .review-select {
          background: var(--color-input);
          border: 1px solid var(--color-border);
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 8px;
        }
        .review-export-btn {
          background: var(--color-highlight);
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 1rem;
          margin-bottom: 2.5rem;
        }
        .stat-card {
          background: var(--color-surface);
          padding: 1.25rem;
          border-radius: 12px;
          border: 1px solid var(--color-border);
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .stat-label {
          font-size: 0.75rem;
          text-transform: uppercase;
          color: var(--color-muted);
          font-weight: 700;
        }
        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
        }
        .stat-card.good { border-color: rgba(74, 222, 128, 0.2); }
        .stat-card.ok { border-color: rgba(251, 191, 36, 0.2); }
        .stat-card.bad { border-color: rgba(248, 113, 113, 0.2); }
        .stat-card.accent { border-color: rgba(var(--color-highlight-rgb), 0.3); }

        .queue-container {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .queue-card {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          overflow: hidden;
        }
        .queue-main {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .queue-row {
          display: flex;
          gap: 1rem;
        }
        .queue-tag {
          font-size: 0.65rem;
          font-weight: 800;
          text-transform: uppercase;
          background: rgba(255,255,255,0.05);
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
          height: fit-content;
          color: var(--color-muted);
          min-width: 60px;
          text-align: center;
        }
        .queue-tag.twi {
          background: rgba(var(--color-highlight-rgb), 0.1);
          color: var(--color-highlight);
        }
        .queue-meta {
          padding: 0.75rem 1.25rem;
          background: rgba(255,255,255,0.02);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .queue-info {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.85rem;
          color: var(--color-muted);
        }
        .rating-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .rating-dot.bad { background: var(--feedback-bad); }
        .rating-dot.ok { background: var(--feedback-ok); }
        
        .queue-review-btn {
          background: transparent;
          border: none;
          color: var(--color-highlight);
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.25rem;
          cursor: pointer;
        }
        .empty-state {
          text-align: center;
          padding: 4rem 0;
          color: var(--color-muted);
        }
      `}</style>
    </div>
  );
}
