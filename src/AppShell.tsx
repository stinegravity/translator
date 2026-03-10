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
      <div className="auth-container">
        <div style={{ color: 'var(--color-muted)', fontSize: '1rem' }}>Loading...</div>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <Suspense
        fallback={
          <div className="auth-container">
            <div style={{ color: 'var(--color-muted)', fontSize: '1rem' }}>Loading...</div>
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
    <Suspense
      fallback={
        <div className="auth-container">
          <div style={{ color: 'var(--color-muted)', fontSize: '1rem' }}>Loading...</div>
        </div>
      }
    >
      <App auth={auth} />
    </Suspense>
  );
}
