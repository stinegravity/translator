import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Languages, ArrowRight, Loader2, ArrowLeft } from 'lucide-react';

interface AuthPageProps {
  onLogin: (email: string, password: string) => Promise<unknown>;
  onRegister: (email: string, password: string, name: string) => Promise<unknown>;
  onForgotPassword?: (email: string) => Promise<unknown>;
  onResetPassword?: (newPassword: string, token: string) => Promise<unknown>;
}

export function AuthPage({ onLogin, onRegister, onForgotPassword, onResetPassword }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const err = params.get('error');
    if (token && !err) {
      setResetToken(token);
      setMode('reset');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (err === 'INVALID_TOKEN') {
      setError('This reset link has expired or is invalid. Please request a new one.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await onLogin(email, password);
      } else if (mode === 'register') {
        if (!name.trim()) {
          setError('Name is required');
          setLoading(false);
          return;
        }
        if (password.length < 8) {
          setError('Password must be at least 8 characters');
          setLoading(false);
          return;
        }
        await onRegister(email, password, name.trim());
      } else if (mode === 'forgot' && onForgotPassword) {
        await onForgotPassword(email);
        setResetSent(true);
      } else if (mode === 'reset' && onResetPassword && resetToken) {
        if (password.length < 8) {
          setError('Password must be at least 8 characters');
          setLoading(false);
          return;
        }
        await onResetPassword(password, resetToken);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'reset' && resetToken) {
    return (
      <div className="auth-container">
        <motion.div
          className="auth-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="auth-header">
            <Languages size={36} color="var(--color-highlight)" />
            <h1 className="auth-title">Set new password</h1>
            <p className="auth-subtitle">Enter your new password below.</p>
          </div>
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label htmlFor="new-password">New password</label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            {error && (
              <motion.div className="auth-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {error}
              </motion.div>
            )}
            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  Reset password
                  <ArrowRight size={18} />
                </>
              )}
            </button>
            <button
              type="button"
              className="auth-link-btn"
              onClick={() => { setMode('login'); setError(null); setResetToken(null); }}
            >
              <ArrowLeft size={16} />
              Back to sign in
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  if (mode === 'forgot') {
    return (
      <div className="auth-container">
        <motion.div
          className="auth-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="auth-header">
            <Languages size={36} color="var(--color-highlight)" />
            <h1 className="auth-title">Reset password</h1>
            <p className="auth-subtitle">
              {resetSent
                ? 'Check your email for a reset link.'
                : 'Enter your email and we\'ll send you a reset link.'}
            </p>
          </div>
          {!resetSent ? (
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-field">
                <label htmlFor="forgot-email">Email</label>
                <input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </div>
              {error && (
                <motion.div className="auth-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {error}
                </motion.div>
              )}
              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    Send reset link
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          ) : null}
          <button
            type="button"
            className="auth-link-btn"
            onClick={() => { setMode('login'); setError(null); setResetSent(false); }}
          >
            <ArrowLeft size={16} />
            Back to sign in
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <motion.div
        className="auth-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="auth-header">
          <Languages size={36} color="var(--color-highlight)" />
          <h1 className="auth-title">KyereAse</h1>
          <p className="auth-subtitle">Intelligent Twi translations with precision context.</p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setError(null); }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); setError(null); }}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <AnimatePresence mode="wait">
            {mode === 'register' && (
              <motion.div
                key="name"
                className="auth-field"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </motion.div>
            )}
          </AnimatePresence>

          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Min. 8 characters' : 'Your password'}
              required
              minLength={mode === 'register' ? 8 : undefined}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
          </div>

          {mode === 'login' && onForgotPassword && (
            <button
              type="button"
              className="auth-link-btn"
              onClick={() => { setMode('forgot'); setError(null); }}
            >
              Forgot password?
            </button>
          )}

          {error && (
            <motion.div
              className="auth-error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {error}
            </motion.div>
          )}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <>
                {mode === 'login' ? 'Sign in' : 'Create account'}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>Free tier includes 500 characters/day, 3 transcriptions, and 3 TTS requests.</p>
        </div>
      </motion.div>
    </div>
  );
}
