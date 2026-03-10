import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

const isPortal = window.location.pathname === '/portal';
const AppShell = lazy(async () => await import('./AppShell').then((module) => ({ default: module.AppShell })));
const Portal = lazy(async () => await import('./Portal').then((module) => ({ default: module.Portal })));
const Root = isPortal ? Portal : AppShell;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense
      fallback={
        <div className="auth-container">
          <div style={{ color: 'var(--color-muted)', fontSize: '1rem' }}>Loading...</div>
        </div>
      }
    >
      <Root />
    </Suspense>
  </StrictMode>
);
