import { Suspense, lazy, useEffect } from 'react';
import { useAuth } from './hooks/useAuth';
import { perfMetrics } from './lib/perfMetrics';
import './App.css';

const AuthPage = lazy(async () => await import('./components/AuthPage').then((module) => ({ default: module.AuthPage })));
const App = lazy(async () => await import('./App'));

export function AppShell() {
  const auth = useAuth();

  useEffect(() => {
    if (auth.isAuthenticated && !auth.isLoading) {
      perfMetrics.markAppReady();
    }
  }, [auth.isAuthenticated, auth.isLoading]);

  if (auth.isLoading) {
    return (
      <div className="auth-layout" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ color: 'var(--color-muted)', fontSize: '1.25rem', fontWeight: 600 }}>Loading KyereAse...</div>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <Suspense
        fallback={
          <div className="auth-layout" style={{ justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ color: 'var(--color-muted)', fontSize: '1.25rem', fontWeight: 600 }}>Preparing workspace...</div>
          </div>
        }
      >
        <AuthPage
          onLogin={auth.login}
          onRegister={auth.register}
          onForgotPassword={auth.forgotPassword}
          onResetPassword={auth.doResetPassword}
        />
      </Suspense>
    );
  }

  return (
    <>
      <a href="#main-content" className="skip-to-content">Skip to content</a>
      <Suspense
        fallback={
          <div className="auth-container">
            <div style={{ color: 'var(--color-muted)', fontSize: '1rem' }}>Loading...</div>
          </div>
        }
      >
        <App auth={auth} />
      </Suspense>
    </>
  );
}
