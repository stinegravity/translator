export function AdminSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="admin-skeleton" aria-busy="true" aria-label="Loading content">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="admin-skeleton-row">
          <div className="admin-skeleton-line" style={{ width: '25%' }} />
          <div className="admin-skeleton-line" style={{ width: '40%' }} />
          <div className="admin-skeleton-line short" style={{ width: '15%' }} />
        </div>
      ))}
      <style>{`
        .admin-skeleton-row {
          display: flex;
          gap: 1rem;
          padding: 0.75rem 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }
        .admin-skeleton-line {
          height: 14px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
          position: relative;
          overflow: hidden;
        }
        .admin-skeleton-line::after {
          content: "";
          position: absolute;
          inset: 0;
          transform: translateX(-100%);
          background-image: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0,
            rgba(255, 255, 255, 0.03) 20%,
            rgba(255, 255, 255, 0.06) 60%,
            rgba(255, 255, 255, 0)
          );
          animation: admin-shimmer 2s infinite;
        }
        @keyframes admin-shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
