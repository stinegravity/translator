import { useCallback, useEffect, useState } from 'react';
import { useSession, signIn, signUp, signOut, sendVerificationEmail, requestPasswordReset, resetPassword } from '../lib/auth-client';
import { perfMetrics } from '../lib/perfMetrics';
import type { TierName, UsageData } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

export function useAuth() {
  const { data: session, isPending } = useSession();
  const [usage, setUsage] = useState<UsageData | null>(null);

  const fetchUsage = useCallback(async () => {
    if (!session?.user) return;
    try {
      const res = await fetch(`${API_BASE}/api/usage`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setUsage(data);
        perfMetrics.markUsageLoaded();
      }
    } catch {
      // silent fail — usage is non-critical
    }
  }, [session?.user]);

  useEffect(() => {
    if (session?.user && !isPending) {
      perfMetrics.markAuthResolved();
    }
  }, [isPending, session?.user]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await signIn.email({ email, password });
      if (result.error) throw new Error(result.error.message || 'Login failed');
      return result;
    },
    []
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const result = await signUp.email({ email, password, name });
      if (result.error) throw new Error(result.error.message || 'Registration failed');
      return result;
    },
    []
  );

  const logout = useCallback(async () => {
    await signOut();
    setUsage(null);
  }, []);

  const resendVerification = useCallback(async (email: string) => {
    const result = await sendVerificationEmail({ email, callbackURL: '/' });
    if (result.error) throw new Error(result.error.message || 'Failed to send verification email');
    return result;
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    const result = await requestPasswordReset({
      email,
      redirectTo: window.location.origin + '/',
    });
    if (result.error) throw new Error(result.error.message || 'Failed to send reset email');
    return result;
  }, []);

  const doResetPassword = useCallback(async (newPassword: string, token: string) => {
    const result = await resetPassword({ newPassword, token });
    if (result.error) throw new Error(result.error.message || 'Failed to reset password');
    return result;
  }, []);

  return {
    user: session?.user
      ? {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name || undefined,
          tier: ((session.user as Record<string, unknown>).tier as TierName) || 'FREE',
          emailVerified: (session.user as Record<string, unknown>).emailVerified as boolean | undefined,
        }
      : null,
    isLoading: isPending,
    isAuthenticated: !!session?.user,
    usage: session?.user ? usage : null,
    login,
    register,
    logout,
    refreshUsage: fetchUsage,
    resendVerification,
    forgotPassword,
    doResetPassword,
  };
}
