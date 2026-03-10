import { motion } from 'framer-motion';
import { Languages, History as HistoryIcon, Settings2, LogOut } from 'lucide-react';
import type { AuthUser } from '../types';

interface HeaderProps {
  onToggleHistory: () => void;
  onToggleSettings: () => void;
  showHistory: boolean;
  showSettings: boolean;
  user: AuthUser | null;
  onLogout: () => Promise<void>;
}

function TierBadge({ tier }: { tier: string }) {
  const cls =
    tier === 'PRO' ? 'tier-badge pro' :
    tier === 'TEAM' ? 'tier-badge team' :
    tier === 'ENTERPRISE' ? 'tier-badge enterprise' :
    'tier-badge';
  return <span className={cls}>{tier}</span>;
}

export function Header({ onToggleHistory, onToggleSettings, showHistory, showSettings, user, onLogout }: HeaderProps) {
  return (
    <header>
      <div className="header-row">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="header-brand"
        >
          <Languages size={40} color="var(--color-highlight)" />
          <h1 id="main-title">KyereAse</h1>
        </motion.div>
        <div className="header-actions">
          {user && (
            <div className="user-menu">
              <TierBadge tier={user.tier} />
              <span className="user-menu-trigger">
                <span className="user-menu-name">{user.name || user.email}</span>
              </span>
              <button className="logout-btn" onClick={onLogout} title="Sign out">
                <LogOut size={16} />
              </button>
            </div>
          )}
          <button
            className="history-btn"
            onClick={onToggleSettings}
            title="Settings"
            style={{ color: showSettings ? 'var(--color-highlight)' : 'inherit' }}
          >
            <Settings2 size={22} />
          </button>
          <button
            className="history-btn"
            onClick={onToggleHistory}
            title="History"
            style={{ color: showHistory ? 'var(--color-highlight)' : 'inherit' }}
          >
            <HistoryIcon size={24} />
          </button>
        </div>
      </div>
      <motion.p className="subtitle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        Intelligent Twi translations with precision context.
      </motion.p>
    </header>
  );
}
