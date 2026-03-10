import { AnimatePresence, motion } from 'framer-motion';
import { Download, ExternalLink, FileText, Subtitles, X } from 'lucide-react';
import { UsageDashboard } from './UsageDashboard';
import type { AuthUser, ExportItem, UsageData } from '../types';

interface SettingsPanelProps {
  show: boolean;
  user: AuthUser | null;
  usage: UsageData | null;
  exportEnabled: boolean;
  exports: ExportItem[];
  exportsLoading: boolean;
  exportsError: string | null;
  settingsSaving: boolean;
  settingsError: string | null;
  onDownloadExport: (exportId: string) => Promise<void>;
  onRefreshExports: () => Promise<void>;
  onClose: () => void;
}

function formatExportLabel(format: string) {
  return format.toUpperCase();
}

function ExportFormatIcon({ format }: { format: string }) {
  if (format === 'srt' || format === 'vtt') {
    return <Subtitles size={16} />;
  }

  return <FileText size={16} />;
}

export function SettingsPanel({
  show,
  user,
  usage,
  exportEnabled,
  exports,
  exportsLoading,
  exportsError,
  settingsSaving,
  settingsError,
  onDownloadExport,
  onRefreshExports,
  onClose,
}: SettingsPanelProps) {
  return (
    <AnimatePresence>
      {show ? (
        <>
          <motion.div className="history-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.aside
            className="settings-sidebar"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="history-header">
              <span>Settings</span>
              <button type="button" className="history-close-btn" onClick={onClose} aria-label="Close settings">
                <X size={20} />
              </button>
            </div>

            <div className="settings-content">
              {user && (
                <section className="settings-section">
                  <div className="settings-section-title">Account</div>
                  <div className="settings-field">
                    <span>Email</span>
                    <div style={{ color: 'var(--color-text)', fontSize: '0.95rem' }}>{user.email}</div>
                  </div>
                  {user.name && (
                    <div className="settings-field">
                      <span>Name</span>
                      <div style={{ color: 'var(--color-text)', fontSize: '0.95rem' }}>{user.name}</div>
                    </div>
                  )}
                </section>
              )}

              {user && <UsageDashboard usage={usage} tier={user.tier} />}

              <section className="settings-section">
                <div className="settings-section-title">Operations</div>
                <a href="/portal" className="portal-link">
                  <ExternalLink size={16} />
                  Open portal dashboard
                </a>
                <p className="settings-help">Operational visibility has been moved out of the translator UI into a separate portal dashboard.</p>
              </section>

              <section className="settings-section">
                <div className="settings-section-title">Persistence</div>
                <p className="settings-help">
                  {settingsSaving ? 'Saving your preferences...' : 'Preferences save automatically when direction, mode, or diarization changes.'}
                </p>
                {settingsError ? <p className="settings-error">{settingsError}</p> : null}
              </section>

              {exportEnabled ? (
                <section className="settings-section">
                  <div className="settings-section-title settings-section-title-row">
                    <span>Exports</span>
                    <button type="button" className="settings-mini-btn" onClick={() => void onRefreshExports()}>
                      Refresh
                    </button>
                  </div>
                  <p className="settings-help">Saved export artifacts can be re-downloaded here.</p>
                  {exportsLoading ? <p className="settings-help">Loading exports...</p> : null}
                  {exportsError ? <p className="settings-error">{exportsError}</p> : null}
                  {!exportsLoading && exports.length === 0 ? <p className="settings-help">No saved exports yet.</p> : null}
                  {exports.length > 0 ? (
                    <div className="exports-list">
                      {exports.map((item) => (
                        <div key={item.id} className="export-row">
                          <div className="export-row-meta">
                            <span className="export-badge">
                              <ExportFormatIcon format={item.format} />
                              {formatExportLabel(item.format)}
                            </span>
                            <div className="export-row-details">
                              <strong>{item.fileName}</strong>
                              <span>
                                {item.conversation ? `Chat: ${item.conversation.title}` : item.history ? `History item: ${new Date(item.history.createdAt).toLocaleString()}` : 'Saved export'}
                              </span>
                              <span>{new Date(item.createdAt).toLocaleString()}</span>
                            </div>
                          </div>
                          <button type="button" className="settings-mini-btn" onClick={() => void onDownloadExport(item.id)}>
                            <Download size={14} />
                            Download
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </section>
              ) : null}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
