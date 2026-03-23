import { useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { AuthPage } from './components/AuthPage';
import { AdminDashboard } from './components/AdminDashboard';
import { NotFoundPage } from './components/NotFoundPage';
import { Portal } from './Portal';
import './Portal.css';
import './App.css';

type PortalTab = 'overview' | 'review';

const PORTAL_BASE = '/portal';
const isPortalPath = (path: string) => path === PORTAL_BASE || path === `${PORTAL_BASE}/` || path.startsWith(`${PORTAL_BASE}/`);

export function PortalShell() {
  const isKnownPath = isPortalPath(window.location.pathname) || window.location.pathname === '/';
  const auth = useAuth();
  const [tab, setTab] = useState<PortalTab>('overview');

  if (!isKnownPath) {
    const backHref = window.location.pathname.startsWith('/portal') ? '/portal/' : '/';
    return <NotFoundPage title="Portal page not found" description="This portal route does not exist." backHref={backHref} backLabel="Back to portal home" />;
  }

  if (auth.isLoading) {
    return (
      <div className="auth-layout" style={{ justifyContent: 'center', alignItems: 'center', background: 'var(--color-bg)' }}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="portal-loading"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Activity size={56} color="var(--color-highlight)" />
          </motion.div>
          <div style={{ color: 'var(--color-text)', fontSize: '1rem', fontWeight: 700, letterSpacing: '4px', opacity: 0.8 }}>VERIFYING CREDENTIALS</div>
        </motion.div>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <AuthPage
        onLogin={auth.login}
        onRegister={auth.register}
        onForgotPassword={auth.forgotPassword}
        onResetPassword={auth.doResetPassword}
      />
    );
  }

  if (!auth.user?.portalAccess) {
    const appUrl = window.location.hostname === 'localhost' 
      ? `http://${window.location.hostname}:5173` 
      : '/';

    return (
      <div className="auth-layout" style={{ justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
        <div className="portal-section" style={{ maxWidth: 560, width: '100%', textAlign: 'center' }}>
          <div className="portal-brand" style={{ marginBottom: '1.5rem', justifyContent: 'center' }}>
            <ShieldCheck size={32} color="var(--color-highlight)" />
            <h1 style={{ fontSize: '1.75rem' }}>Portal Access Restricted</h1>
          </div>
          <p className="portal-subtitle" style={{ marginBottom: '1rem', fontSize: '1rem' }}>
            The admin portal is restricted to internal operations accounts.
          </p>
          <p style={{ color: 'var(--color-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
            You are logged in as <strong>{auth.user?.email}</strong>. If you believe this is an error, please contact the system administrator.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <a href={appUrl} className="portal-refresh" style={{ textDecoration: 'none' }}>
              <ArrowLeft size={16} />
              Back to app
            </a>
            <button type="button" className="portal-refresh" onClick={() => void auth.logout()}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppErrorBoundary>
      <div className="portal-container">
        <header className="portal-header">
          <div className="portal-brand">
            <Activity size={32} color="var(--color-highlight)" />
            <div className="portal-brand-text">
              <h1>KyereAse Portal</h1>
              <p>Operational workspace & system control</p>
            </div>
            <div style={{ flex: 1 }} />
            <a href="/" className="portal-back">
              <ArrowLeft size={18} />
              Return to KyereAse
            </a>
          </div>
          <div className="admin-tab-nav" style={{ marginTop: '1.25rem' }}>
            <button className={`admin-tab-btn ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>
              <Activity size={16} />
              Overview
            </button>
            <button className={`admin-tab-btn ${tab === 'review' ? 'active' : ''}`} onClick={() => setTab('review')}>
              <ShieldCheck size={16} />
              Review Queue
            </button>
            <button className="admin-tab-btn" onClick={() => void auth.logout()}>
              Sign out
            </button>
          </div>
        </header>

        {tab === 'overview' ? <Portal user={auth.user} /> : <AdminDashboard currentUser={auth.user} />}
      </div>
    </AppErrorBoundary>
  );
}
