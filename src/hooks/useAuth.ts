import { useCallback, useEffect, useState } from 'react';
import { useSession, signIn, signUp, signOut, sendVerificationEmail, requestPasswordReset, resetPassword } from '../lib/auth-client';
import { perfMetrics } from '../lib/perfMetrics';
import type { AuthUser, InternalRole, ReviewerAccessStatus, TierName, UsageData } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

export function useAuth() {
  const { data: session, isPending } = useSession();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [accountUser, setAccountUser] = useState<AuthUser | null>(null);
  const [accountLoaded, setAccountLoaded] = useState(false);

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

  useEffect(() => {
    let cancelled = false;

    async function loadAccount() {
      if (!session?.user) {
        setAccountUser(null);
        setAccountLoaded(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/me`, {
          credentials: 'include',
          headers: { 'X-Requested-With': 'KyereAse' },
        });
        if (!res.ok) {
          if (!cancelled) setAccountLoaded(true);
          return;
        }

        const data = (await res.json()) as {
          user: {
            id: string;
            email: string;
            name?: string | null;
            tier: TierName;
            portalAccess: boolean;
            internalRole: InternalRole;
            reviewerAccess: boolean;
            reviewerAccessStatus: ReviewerAccessStatus;
          };
        };

        if (!cancelled) {
          setAccountUser({
            id: data.user.id,
            email: data.user.email,
            name: data.user.name || undefined,
            tier: data.user.tier,
            portalAccess: data.user.portalAccess,
            internalRole: data.user.internalRole,
            reviewerAccess: data.user.reviewerAccess,
            reviewerAccessStatus: data.user.reviewerAccessStatus,
            emailVerified: typeof (session.user as Record<string, unknown>).emailVerified === 'boolean' ? (session.user as Record<string, unknown>).emailVerified as boolean : undefined,
          });
          setAccountLoaded(true);
        }
      } catch {
        // Fall back to auth session fields if account lookup fails.
        if (!cancelled) setAccountLoaded(true);
      }
    }

    void loadAccount();

    return () => {
      cancelled = true;
    };
  }, [session?.user]);

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
    setAccountUser(null);
    setUsage(null);
    window.location.href = window.location.origin;
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
    user: accountUser ??
      (session?.user
      ? (() => {
          const u = session.user as Record<string, unknown>;
          return {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name || undefined,
            tier: (typeof u.tier === 'string' ? u.tier as TierName : 'FREE'),
            portalAccess: Boolean(u.portalAccess),
            internalRole: (typeof u.internalRole === 'string' ? u.internalRole as InternalRole : 'CUSTOMER'),
            reviewerAccess: Boolean(u.reviewerAccess),
            reviewerAccessStatus: (typeof u.reviewerAccessStatus === 'string' ? u.reviewerAccessStatus as ReviewerAccessStatus : 'NONE'),
            emailVerified: typeof u.emailVerified === 'boolean' ? u.emailVerified : undefined,
          };
        })()
      : null),
    isLoading: isPending || (!!session?.user && !accountLoaded),
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
