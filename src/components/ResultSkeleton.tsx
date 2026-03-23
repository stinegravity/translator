interface ResultSkeletonProps {
  message?: string;
}

export function ResultSkeleton({ message }: ResultSkeletonProps) {
  return (
    <div className="results-container skeleton">
      {message && (
        <p className="skeleton-message" aria-live="polite">
          {message}
        </p>
      )}
      <div className="result-card">
        <div className="result-card-header">
          <div className="skeleton-line short" />
        </div>
        <div className="result-card-content">
          <div className="skeleton-line" />
          <div className="skeleton-line" />
          <div className="skeleton-line medium" />
        </div>
      </div>
      
      <div className="result-card secondary">
        <div className="result-card-header">
          <div className="skeleton-line short" />
        </div>
        <div className="result-card-content">
          <div className="skeleton-line" />
          <div className="skeleton-line medium" />
        </div>
      </div>
      
      <style>{`
        .skeleton-line {
          height: 16px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
          margin-bottom: 0.75rem;
          position: relative;
          overflow: hidden;
        }
        
        .skeleton-line::after {
          content: "";
          position: absolute;
          top: 0;
          right: 0;
          bottom: 0;
          left: 0;
          transform: translateX(-100%);
          background-image: linear-gradient(
            90deg,
            rgba(255, 255, 255, 0) 0,
            rgba(255, 255, 255, 0.03) 20%,
            rgba(255, 255, 255, 0.06) 60%,
            rgba(255, 255, 255, 0)
          );
          animation: shimmer 2s infinite;
        }
        
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
        
        .skeleton-line.short { width: 30%; }
        .skeleton-line.medium { width: 60%; }
        
        .result-card.secondary { margin-top: 1.5rem; opacity: 0.6; }
        
        .skeleton-message {
          text-align: center;
          color: var(--color-muted); 
          font-size: 0.9rem;
          margin-bottom: 1rem;
          margin-top: 0;
        }
      `}</style>
    </div>
  );
}
