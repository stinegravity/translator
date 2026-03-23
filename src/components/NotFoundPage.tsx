import { ArrowLeft, Compass } from 'lucide-react';

interface NotFoundPageProps {
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}

export function NotFoundPage({
  title = 'Page not found',
  description = 'The page you requested does not exist.',
  backHref = '/',
  backLabel = 'Back to home',
}: NotFoundPageProps) {
  return (
    <div className="not-found-layout">
      <div className="not-found-content">
        <Compass size={28} color="var(--color-highlight)" />
        <h1>{title}</h1>
        <p>{description}</p>
        <div className="not-found-actions">
          <a href={backHref} className="portal-refresh" style={{ textDecoration: 'none' }}>
            <ArrowLeft size={16} />
            {backLabel}
          </a>
        </div>
      </div>
    </div>
  );
}
