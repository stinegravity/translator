import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { ChevronRight, Download, CheckCircle, Shield, MessageSquare, Users, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomSelect } from './CustomSelect';
import { AdminSkeleton } from './AdminSkeleton';
import type { AuthUser, InternalRole, InternalUserItem, ReviewerApplicationItem } from '../types';

interface ReviewItem {
  id: string;
  source: string;
  aiOutput: string;
  correction: string | null;
  rating: number;
  dialect: string | null;
  domain: string | null;
  createdAt: string;
}

interface AuditLog {
  id: string;
  action: string;
  userEmail: string | null;
  ip: string | null;
  method: string;
  path: string;
  statusCode: number;
  createdAt: string;
}

interface AdminDashboardProps {
  currentUser: AuthUser | null;
}

const dialectOptions = [
  { label: 'All Dialects', value: 'all' },
  { label: 'Asante Twi', value: 'Asante Twi' },
  { label: 'Akuapem Twi', value: 'Akuapem Twi' },
  { label: 'Fante', value: 'Fante' },
];

const roleOptions = [
  { label: 'CUSTOMER', value: 'CUSTOMER' as InternalRole },
  { label: 'OPS', value: 'OPS' as InternalRole },
  { label: 'ADMIN', value: 'ADMIN' as InternalRole },
];

export function AdminDashboard({ currentUser }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'review' | 'audit' | 'access' | 'models'>('review');
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [internalUsers, setInternalUsers] = useState<InternalUserItem[]>([]);
  const [reviewerRequests, setReviewerRequests] = useState<ReviewerApplicationItem[]>([]);
  const [stats, setStats] = useState({ total: 0, good: 0, ok: 0, bad: 0, corrected: 0 });
  const [loading, setLoading] = useState(true);
  const [dialect, setDialect] = useState<string>('all');
  const [accessSavingId, setAccessSavingId] = useState<string | null>(null);
  const [modelConfigItems, setModelConfigItems] = useState<Array<{ key: string; label: string; value: string; default: string }>>([]);
  const [modelConfigDraft, setModelConfigDraft] = useState<Record<string, string>>({});
  const [modelConfigSaving, setModelConfigSaving] = useState(false);

  const canManageAccess = currentUser?.internalRole === 'ADMIN';

  const loadReviewData = useCallback(async () => {
    try {
      const statsData = await api.feedback.stats(dialect === 'all' ? undefined : dialect);
      setStats(statsData.stats);

      const queueResponse = await fetch(`/api/review-queue?${dialect !== 'all' ? `dialect=${dialect}` : ''}`);
      const queueData = await queueResponse.json();
      setReviewItems(queueData.items);
    } catch (err) {
      console.error('Failed to load review data', err);
    }
  }, [dialect]);

  const loadAuditData = useCallback(async () => {
    try {
      const response = await fetch('/api/audit-logs');
      const data = await response.json();
      setAuditLogs(data.logs);
    } catch (err) {
      console.error('Failed to load audit logs', err);
    }
  }, []);

  const loadInternalUsers = useCallback(async () => {
    try {
      const [usersData, reviewerData] = await Promise.all([
        api.internalUsers.list(),
        api.reviewerAccess.listRequests('PENDING'),
      ]);
      setInternalUsers(usersData.items);
      setReviewerRequests(reviewerData.items);
    } catch (err) {
      console.error('Failed to load internal access data', err);
    }
  }, []);

  const loadModelConfig = useCallback(async () => {
    try {
      const data = await api.modelConfig.get();
      setModelConfigItems(data.items);
      setModelConfigDraft(Object.fromEntries(data.items.map((i) => [i.key, i.value])));
    } catch (err) {
      console.error('Failed to load model config', err);
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    if (activeTab === 'review') {
      await loadReviewData();
    } else if (activeTab === 'audit') {
      await loadAuditData();
    } else if (activeTab === 'models') {
      await loadModelConfig();
    } else {
      await loadInternalUsers();
    }
    setLoading(false);
  }, [activeTab, loadReviewData, loadAuditData, loadInternalUsers, loadModelConfig]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleExport = () => {
    const url = `/api/feedback/export?${dialect !== 'all' ? `dialect=${dialect}` : ''}`;
    window.open(url, '_blank');
  };

  const handleInternalRoleChange = useCallback(async (userId: string, internalRole: InternalRole) => {
    setAccessSavingId(userId);
    try {
      const response = await api.internalUsers.update(userId, { internalRole });
      setInternalUsers((items) => items.map((item) => (item.id === userId ? response.user : item)));
    } catch (err) {
      console.error('Failed to update internal role', err);
    } finally {
      setAccessSavingId(null);
    }
  }, []);

  const handleReviewerRequest = useCallback(
    async (requestId: string, status: 'APPROVED' | 'REJECTED') => {
      try {
        const response = await api.reviewerAccess.reviewRequest(requestId, { status });
        setReviewerRequests((items) => items.filter((item) => item.id !== requestId));
        setInternalUsers((items) =>
          items.map((item) =>
            item.id === response.application.user.id
              ? {
                  ...item,
                  portalAccess: item.portalAccess,
                  internalRole: item.internalRole,
                }
              : item
          )
        );
      } catch (err) {
        console.error('Failed to review reviewer request', err);
      }
    },
    []
  );

  const handleModelConfigChange = useCallback((key: string, value: string) => {
    setModelConfigDraft((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleModelConfigSave = useCallback(async () => {
    setModelConfigSaving(true);
    try {
      await api.modelConfig.update(modelConfigDraft);
      await loadModelConfig();
    } catch (err) {
      console.error('Failed to save model config', err);
    } finally {
      setModelConfigSaving(false);
    }
  }, [modelConfigDraft, loadModelConfig]);

  const handleModelConfigReset = useCallback(() => {
    setModelConfigDraft(Object.fromEntries(modelConfigItems.map((i) => [i.key, i.default])));
  }, [modelConfigItems]);

  return (
    <div className="admin-dashboard">
      <div className="admin-tab-nav" style={{ marginBottom: '1.5rem', alignSelf: 'flex-start' }}>
        <button 
          className={`admin-tab-btn ${activeTab === 'review' ? 'active' : ''}`}
          onClick={() => setActiveTab('review')}
        >
          <MessageSquare size={16} />
          Review Queue
        </button>
        <button 
          className={`admin-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          <Shield size={16} />
          Logs
        </button>
        {canManageAccess ? (
          <>
            <button
              className={`admin-tab-btn ${activeTab === 'access' ? 'active' : ''}`}
              onClick={() => setActiveTab('access')}
            >
              <Users size={16} />
              Users
            </button>
            <button
              className={`admin-tab-btn ${activeTab === 'models' ? 'active' : ''}`}
              onClick={() => setActiveTab('models')}
            >
              <Cpu size={16} />
              Models
            </button>
          </>
        ) : null}
      </div>
      
      {activeTab === 'review' && (
        <div className="review-actions" style={{ marginBottom: '2rem' }}>
          <CustomSelect
            label=""
            value={dialect}
            onChange={setDialect}
            options={dialectOptions}
          />
          <button onClick={handleExport} className="admin-export-btn">
            <Download size={16} />
            Export Data
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {activeTab === 'review' ? (
          <motion.div 
            key="review"
            initial={{ opacity: 0, x: -10 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: 10 }}
          >
            <div className="stats-grid">
              <div className="stat-card"><span className="stat-label">Total Rated</span><span className="stat-value">{stats.total}</span></div>
              <div className="stat-card good"><span className="stat-label">Good</span><span className="stat-value">{stats.good}</span></div>
              <div className="stat-card ok"><span className="stat-label">Needs Polish</span><span className="stat-value">{stats.ok}</span></div>
              <div className="stat-card bad"><span className="stat-label">Incorrect</span><span className="stat-value">{stats.bad}</span></div>
              <div className="stat-card accent"><span className="stat-label">Human Corrections</span><span className="stat-value">{stats.corrected}</span></div>
            </div>

            <div className="admin-main-list">
              <h2>Needs Human Attention</h2>
              {loading ? <AdminSkeleton rows={4} /> : reviewItems.length === 0 ? (
                <div className="empty-state"><CheckCircle size={48} /><p>Queue is clear!</p></div>
              ) : (
                <div className="queue-container">
                  {reviewItems.map((item) => (
                    <div key={item.id} className="admin-card">
                      <div className="card-main">
                        <div className="card-row"><span className="card-tag">English</span><p>{item.source}</p></div>
                        <div className="card-row alt"><span className="card-tag twi">AI Twi</span><p>{item.aiOutput}</p></div>
                      </div>
                      <div className="card-meta">
                        <div className="card-info">
                          <span className={`rating-dot ${item.rating === 1 ? 'bad' : 'ok'}`} />
                          <span>{item.dialect || 'General'}</span>
                          <span>•</span>
                          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        </div>
                        <button className="card-action-btn">Manage <ChevronRight size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ) : activeTab === 'audit' ? (
          <motion.div 
            key="audit"
            initial={{ opacity: 0, x: 10 }} 
            animate={{ opacity: 1, x: 0 }} 
            exit={{ opacity: 0, x: -10 }}
          >
            <div className="admin-main-list">
              <h2>Recent System Activity</h2>
              <div className="audit-table-container">
                <table className="audit-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Action</th>
                      <th>User</th>
                      <th>Status</th>
                      <th>Path</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{new Date(log.createdAt).toLocaleTimeString()}</td>
                        <td className="audit-action">{log.action}</td>
                        <td className="audit-user">{log.userEmail || 'Anonymous'}</td>
                        <td><span className={`status-badge ${log.statusCode < 400 ? 'success' : 'error'}`}>{log.statusCode}</span></td>
                        <td className="audit-path">{log.path}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        ) : activeTab === 'models' ? (
          <motion.div
            key="models"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
          >
            <div className="admin-main-list">
              <h2>AI model configuration</h2>
              <p className="loading-text" style={{ paddingTop: 0, textAlign: 'left', marginBottom: '1.5rem' }}>
                Override model names used for translation, transcription, and TTS. Changes apply immediately. Empty values fall back to env or defaults.
              </p>
              {loading ? (
                <AdminSkeleton rows={6} />
              ) : (
                <div className="model-config-form">
                  {modelConfigItems.map((item) => (
                    <div key={item.key} className="model-config-row">
                      <label htmlFor={item.key} className="model-config-label">{item.label}</label>
                      <input
                        id={item.key}
                        type="text"
                        value={modelConfigDraft[item.key] ?? item.value}
                        onChange={(e) => handleModelConfigChange(item.key, e.target.value)}
                        placeholder={item.default}
                        className="model-config-input"
                      />
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                    <button
                      type="button"
                      onClick={() => void handleModelConfigSave()}
                      disabled={modelConfigSaving}
                      className="admin-export-btn"
                    >
                      {modelConfigSaving ? 'Saving...' : 'Save changes'}
                    </button>
                    <button
                      type="button"
                      onClick={handleModelConfigReset}
                      disabled={modelConfigSaving}
                      className="admin-export-btn"
                      style={{ background: 'transparent', border: '1px solid var(--color-border)' }}
                    >
                      Reset to defaults
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="access"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
          >
            <div className="admin-main-list">
              <h2>Internal access management</h2>
              <p className="loading-text" style={{ paddingTop: 0, textAlign: 'left' }}>
                Portal access is derived from internal role. `OPS` and `ADMIN` can access the portal. `CUSTOMER` cannot.
              </p>
              <h3 style={{ margin: '0 0 1rem' }}>Reviewer requests</h3>
              {reviewerRequests.length === 0 ? (
                <p className="loading-text" style={{ paddingTop: 0, textAlign: 'left' }}>No pending reviewer requests.</p>
              ) : (
                <div className="queue-container" style={{ marginBottom: '2rem' }}>
                  {reviewerRequests.map((item) => (
                    <div key={item.id} className="admin-card">
                      <div className="card-main">
                        <div className="card-row">
                          <span className="card-tag">User</span>
                          <p>{item.user.name || item.user.email} ({item.user.tier})</p>
                        </div>
                        <div className="card-row alt">
                          <span className="card-tag twi">Credentials</span>
                          <p>{item.credentials}</p>
                        </div>
                        {item.reviewUseCase ? (
                          <div className="card-row">
                            <span className="card-tag">Use case</span>
                            <p>{item.reviewUseCase}</p>
                          </div>
                        ) : null}
                      </div>
                      <div className="card-meta">
                        <div className="card-info">
                          <span>{item.organization || 'Independent reviewer'}</span>
                          <span>•</span>
                          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          <button className="card-action-btn" onClick={() => void handleReviewerRequest(item.id, 'REJECTED')}>Reject</button>
                          <button className="card-action-btn" onClick={() => void handleReviewerRequest(item.id, 'APPROVED')}>Approve</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {loading ? <AdminSkeleton rows={8} /> : (
                <div className="audit-table-container">
                  <table className="audit-table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Tier</th>
                        <th>Internal role</th>
                        <th>Portal</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {internalUsers.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className="internal-user-cell">
                              <strong>{item.name || 'Unnamed user'}</strong>
                              <span className="audit-user">{item.email}</span>
                            </div>
                          </td>
                          <td>{item.tier}</td>
                          <td>
                            <CustomSelect
                              label=""
                              value={item.internalRole}
                              onChange={(val) => void handleInternalRoleChange(item.id, val)}
                              options={roleOptions}
                              className="role-select"
                              disabled={accessSavingId === item.id}
                            />
                          </td>
                          <td>{item.portalAccess ? 'Enabled' : 'Disabled'}</td>
                          <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>      <style>{`
        .admin-dashboard { padding: 2rem; color: var(--color-text); max-width: 1050px; margin: 0 auto; min-height: 80vh; }
        .admin-header { margin-bottom: 3rem; }
        .admin-title-row { display: flex; align-items: center; gap: 1.25rem; margin-bottom: 2rem; }
        .admin-title-row h1 { font-size: 2rem; font-weight: 800; letter-spacing: -1.5px; }
        .admin-back-btn { background: transparent; border: 1px solid var(--color-border); color: white; width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: border-color 0.2s; }
        .admin-back-btn:hover { border-color: var(--color-muted); }
        
        .admin-tab-nav { display: flex; gap: 0.25rem; background: var(--color-input); padding: 4px; border-radius: 14px; margin-bottom: 2rem; width: fit-content; }
        .admin-tab-btn { display: flex; align-items: center; gap: 0.6rem; padding: 0.7rem 1.25rem; border: none; background: transparent; color: var(--color-muted); font-size: 0.9rem; font-weight: 600; cursor: pointer; border-radius: 10px; transition: all 0.2s; }
        .admin-tab-btn.active { background: var(--color-surface); color: white; }
        
        .review-actions { display: flex; gap: 1rem; margin-bottom: 2rem; }
        .admin-select { background: var(--color-input); border: 1px solid var(--color-border); color: white; padding: 0.6rem 1rem; border-radius: 10px; font-size: 0.85rem; font-family: inherit; }
        .admin-export-btn { background: var(--color-highlight); color: white; border: none; padding: 0.6rem 1.25rem; border-radius: 10px; display: flex; align-items: center; gap: 0.6rem; cursor: pointer; font-size: 0.85rem; font-weight: 700; transition: filter 0.2s; }
        .admin-export-btn:hover { filter: brightness(1.1); }
        
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1.5rem; margin-bottom: 3rem; }
        .stat-card { background: var(--color-surface); padding: 1.5rem; border-radius: 16px; border: 1px solid var(--color-border); display: flex; flex-direction: column; }
        .stat-label { font-size: 0.7rem; text-transform: uppercase; color: var(--color-muted); font-weight: 700; margin-bottom: 0.5rem; letter-spacing: 1px; }
        .stat-value { font-size: 1.5rem; font-weight: 800; }
        .stat-card.good .stat-value { color: var(--color-success); }
        .stat-card.bad .stat-value { color: var(--color-error); }
        .stat-card.accent .stat-value { color: var(--color-highlight); }

        .admin-main-list h2 { font-size: 1.25rem; margin-bottom: 1.5rem; color: var(--color-text); font-weight: 700; letter-spacing: -0.5px; }
        .admin-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; margin-bottom: 1.5rem; overflow: hidden; }
        .card-main { padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; }
        .card-row { display: flex; gap: 1.5rem; }
        .card-tag { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: var(--color-muted); min-width: 70px; letter-spacing: 1px; }
        .card-tag.twi { color: var(--color-highlight); }
        .card-meta { padding: 1rem 1.5rem; background: rgba(255,255,255,0.01); border-top: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center; }
        .card-info { display: flex; align-items: center; gap: 0.75rem; font-size: 0.85rem; color: var(--color-muted); }
        .rating-dot { width: 8px; height: 8px; border-radius: 50%; }
        .rating-dot.bad { background: var(--color-error); }
        .rating-dot.ok { background: var(--color-highlight); }
        .card-action-btn { background: transparent; border: none; color: var(--color-highlight); font-size: 0.9rem; font-weight: 700; display: flex; align-items: center; gap: 0.4rem; cursor: pointer; }

        .audit-table-container { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 16px; overflow: hidden; }
        .audit-table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
        .audit-table th { text-align: left; padding: 1.25rem 1.5rem; color: var(--color-muted); font-weight: 700; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 1px; border-bottom: 1px solid var(--color-border); }
        .audit-table td { padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--color-border); }
        .model-config-form { max-width: 480px; }
        .model-config-row { margin-bottom: 1.25rem; }
        .model-config-label { display: block; font-size: 0.85rem; color: var(--color-muted); margin-bottom: 0.5rem; font-weight: 600; }
        .model-config-input { width: 100%; background: var(--color-input); border: 1px solid var(--color-border); color: white; padding: 0.75rem 1rem; border-radius: 10px; font-size: 0.9rem; font-family: inherit; }
        .model-config-input::placeholder { color: var(--color-muted); }
        .audit-action { font-weight: 600; color: white; }
        .audit-user { color: var(--color-muted); }
        .audit-path { color: var(--color-muted); font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; opacity: 0.8; }
        .status-badge { font-size: 0.85rem; font-weight: 700; }
        .status-badge.success { color: var(--color-success); }
        .status-badge.error { color: var(--color-error); }
        .internal-user-cell { display: flex; flex-direction: column; gap: 0.25rem; }
        .empty-state { text-align: center; padding: 4rem 0; color: var(--color-muted); }
        .loading-text { text-align: center; padding: 3rem 0; color: var(--color-muted); font-weight: 500; }
      `}</style>
    </div>
  );
}
