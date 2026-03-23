export type TierName = 'FREE' | 'PRO' | 'TEAM' | 'ENTERPRISE';

export interface TierLimits {
  charsPerDay: number;
  transcriptionsPerDay: number;
  ttsPerDay: number;
  maxHistoryItems: number;
  maxFolders: number;
  conversationsEnabled: boolean;
  audioTrimming: boolean;
  apiAccess: boolean;
  exportEnabled: boolean;
  requestsPerMinute: number;
}

export const TIER_LIMITS: Record<TierName, TierLimits> = {
  FREE: {
    charsPerDay: 500,
    transcriptionsPerDay: 3,
    ttsPerDay: 3,
    maxHistoryItems: 50,
    maxFolders: 1,
    conversationsEnabled: false,
    audioTrimming: false,
    apiAccess: false,
    exportEnabled: false,
    requestsPerMinute: 60,
  },
  PRO: {
    charsPerDay: 10_000,
    transcriptionsPerDay: 50,
    ttsPerDay: 30,
    maxHistoryItems: -1, // unlimited
    maxFolders: -1,
    conversationsEnabled: true,
    audioTrimming: true,
    apiAccess: false,
    exportEnabled: false,
    requestsPerMinute: 120,
  },
  TEAM: {
    charsPerDay: 50_000,
    transcriptionsPerDay: 200,
    ttsPerDay: 100,
    maxHistoryItems: -1,
    maxFolders: -1,
    conversationsEnabled: true,
    audioTrimming: true,
    apiAccess: true,
    exportEnabled: true,
    requestsPerMinute: 300,
  },
  ENTERPRISE: {
    charsPerDay: -1, // unlimited
    transcriptionsPerDay: -1,
    ttsPerDay: -1,
    maxHistoryItems: -1,
    maxFolders: -1,
    conversationsEnabled: true,
    audioTrimming: true,
    apiAccess: true,
    exportEnabled: true,
    requestsPerMinute: 1000,
  },
};

const TIER_RANK: Record<TierName, number> = {
  FREE: 0,
  PRO: 1,
  TEAM: 2,
  ENTERPRISE: 3,
};

export function getTierLimits(tier: TierName): TierLimits {
  return TIER_LIMITS[tier] || TIER_LIMITS.FREE;
}

export function isTierAtLeast(userTier: TierName, requiredTier: TierName): boolean {
  return (TIER_RANK[userTier] ?? 0) >= (TIER_RANK[requiredTier] ?? 0);
}
