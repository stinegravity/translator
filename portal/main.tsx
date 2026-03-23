import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/index.css';
import { AppErrorBoundary } from '../src/components/AppErrorBoundary';
import { PortalShell } from '../src/PortalShell';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <PortalShell />
    </AppErrorBoundary>
  </StrictMode>
);
