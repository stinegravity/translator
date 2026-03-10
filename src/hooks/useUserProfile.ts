import { useEffect, useState } from 'react';
import type { UserProfile } from '../types';

const STORAGE_KEY = 'kyerease-user-profile';

function getStoredProfile(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    if (typeof parsed.email !== 'string' || !parsed.email.trim()) return null;
    return { email: parsed.email.trim(), name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : undefined };
  } catch {
    return null;
  }
}

/** @deprecated Use useAuth() instead for authenticated flows */
export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile>(() => getStoredProfile() ?? { email: '', name: '' });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const normalized = { email: profile.email.trim(), name: profile.name?.trim() || undefined };
    if (!normalized.email) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }, [profile]);

  return {
    profile,
    setProfile,
    hasIdentity: Boolean(profile.email.trim()),
  };
}
