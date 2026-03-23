import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ArrowRight, ArrowLeft, Eye, EyeOff, Globe } from 'lucide-react';

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
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const err = params.get('error');
    if (token && !err) {
      setResetToken(token);
      setMode('reset');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (err === 'INVALID_TOKEN') {
      setError('Invalid or expired reset link.');
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
        if (!name.trim()) throw new Error('Name is required');
        if (password.length < 8) throw new Error('Password must be at least 8 characters');
        await onRegister(email, password, name.trim());
      } else if (mode === 'forgot' && onForgotPassword) {
        await onForgotPassword(email);
        setResetSent(true);
      } else if (mode === 'reset' && onResetPassword && resetToken) {
        if (password.length < 8) throw new Error('Password must be at least 8 characters');
        await onResetPassword(password, resetToken);
      }
    } catch (err: unknown) {
      // Use generic message for login to avoid leaking whether an account exists
      if (mode === 'login') {
        setError('Invalid email or password');
      } else {
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
      {/* Hero Section */}
      <div className="auth-hero">
        <img src="/assets/auth-hero.png" alt="Hero" className="auth-hero-img" />
        <div className="auth-hero-content">
          <Globe size={24} color="var(--color-highlight)" style={{ marginBottom: '1.5rem', opacity: 0.6 }} />
          <h4>Beyond translation. <br/>Pure understanding.</h4>
          <p>Preserving the soul of the Twi language through elite-grade linguistic modeling.</p>
        </div>
      </div>

      {/* Form Section */}
      <div className="auth-form-side">
        <div className="auth-form-container">
          <div className="auth-form-header">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={mode}
              transition={{ duration: 0.4 }}
            >
              <h1 style={{ fontWeight: 700 }}>
                {mode === 'login' && 'Sign in to KyereAse'}
                {mode === 'register' && 'Begin your journey'}
                {mode === 'forgot' && 'Account recovery'}
                {mode === 'reset' && 'Secure your access'}
              </h1>
              <p style={{ fontWeight: 400, opacity: 0.7 }}>
                {mode === 'forgot' && 'Enter your email to receive a secure recovery link.'}
                {mode === 'reset' && 'Please select a new high-entropy password.'}
              </p>
            </motion.div>
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
                >
                  <label htmlFor="name">Linguist Name</label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    required
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
              <div className="auth-field">
                <label htmlFor="email">Email address</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  required
                />
              </div>
            )}

            {(mode === 'login' || mode === 'register' || mode === 'reset') && (
              <div className="auth-field">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label htmlFor="password">Security Key</label>
                  {mode === 'login' && (
                    <button 
                      type="button" 
                      className="auth-link-btn" 
                      onClick={() => setMode('forgot')}
                      style={{ fontSize: '0.75rem', fontWeight: 500, opacity: 0.6 }}
                    >
                      Recovery needed?
                    </button>
                  )}
                </div>
                <div className="auth-input-wrapper">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={mode === 'register' || mode === 'reset' ? 8 : undefined}
                  />
                  <button
                    type="button"
                    className="auth-eye-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            )}

            {error && (
              <motion.div className="auth-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                {error}
              </motion.div>
            )}

            {mode === 'forgot' && resetSent ? (
              <div className="auth-error" style={{ color: 'var(--color-success)' }}>
                Recovery link dispatched. Check your inbox.
              </div>
            ) : (
              <button type="submit" className="auth-submit" disabled={loading} style={{ fontWeight: 600 }}>
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    {mode === 'login' && 'Enter Workspace'}
                    {mode === 'register' && 'Create Identity'}
                    {mode === 'forgot' && 'Request Link'}
                    {mode === 'reset' && 'Confirm Update'}
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            )}

            {(mode === 'forgot' || mode === 'reset') && (
              <button
                type="button"
                className="auth-link-btn"
                onClick={() => { setMode('login'); setError(null); }}
                style={{ marginTop: '0.5rem' }}
              >
                <ArrowLeft size={16} />
                Return to sign in
              </button>
            )}
          </form>

          <div className="auth-footer">
            <button
              type="button"
              className="auth-mode-toggle"
              onClick={() => { 
                setMode(mode === 'login' ? 'register' : 'login'); 
                setError(null); 
              }}
            >
              {mode === 'login' ? (
                <>New to the platform? <span>Onboard here</span></>
              ) : (
                <>Existing member? <span>Validate access</span></>
              )}
            </button>
            <p className="auth-tier-info">Professional access grants sub-millisecond translation speeds, advanced neural folders, and lossless audio synthesis.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
