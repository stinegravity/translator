import type { UsageData, TierName } from '../types';

interface UsageDashboardProps {
  usage: UsageData | null;
  tier: TierName;
}

function UsageBar({ used, limit }: { used: number; limit: number }) {
  if (limit === -1) {
    return (
      <div className="usage-bar">
        <div className="usage-bar-fill" style={{ width: '5%' }} />
      </div>
    );
  }

  const pct = Math.min((used / limit) * 100, 100);
  const cls = pct >= 90 ? 'critical' : pct >= 70 ? 'warning' : '';

  return (
    <div className="usage-bar">
      <div className={`usage-bar-fill ${cls}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function formatLimit(limit: number): string {
  if (limit === -1) return 'unlimited';
  if (limit >= 1000) return `${(limit / 1000).toFixed(limit % 1000 === 0 ? 0 : 1)}k`;
  return String(limit);
}

function tierBadgeClass(tier: TierName): string {
  if (tier === 'PRO') return 'tier-badge pro';
  if (tier === 'TEAM') return 'tier-badge team';
  if (tier === 'ENTERPRISE') return 'tier-badge enterprise';
  return 'tier-badge';
}

export function UsageDashboard({ usage, tier }: UsageDashboardProps) {
  if (!usage) return null;

  const rows = [
    { label: 'Translation characters', ...usage.usage.translate },
    { label: 'Audio transcriptions', ...usage.usage.transcribe },
    { label: 'Text-to-speech', ...usage.usage.tts },
  ];

  return (
    <div className="usage-section">
      <div className="settings-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Today's usage</span>
        <span className={tierBadgeClass(tier)}>{tier}</span>
      </div>
      <div className="usage-grid">
        {rows.map((row) => (
          <div key={row.label} className="usage-row">
            <div className="usage-row-header">
              <span className="usage-label">{row.label}</span>
              <span className="usage-count">
                {row.used.toLocaleString()} / {formatLimit(row.limit)}
              </span>
            </div>
            <UsageBar used={row.used} limit={row.limit} />
          </div>
        ))}
      </div>
    </div>
  );
}
