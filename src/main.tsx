import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { NotFoundPage } from './components/NotFoundPage';
import './index.css';

const AppShell = lazy(async () => await import('./AppShell').then((module) => ({ default: module.AppShell })));
const isKnownPath = window.location.pathname === '/';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      {isKnownPath ? (
        <Suspense
          fallback={
            <div className="auth-layout" style={{ justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ color: 'var(--color-muted)', fontSize: '1.25rem', fontWeight: 600 }}>Loading KyereAse...</div>
            </div>
          }
        >
          <AppShell />
        </Suspense>
      ) : (
        <NotFoundPage />
      )}
    </AppErrorBoundary>
  </StrictMode>
);
