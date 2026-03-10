import type { TierName, UsageData } from '../types';

const FEATURE_FLAGS: Record<TierName, UsageData['features']> = {
  FREE: {
    conversationsEnabled: false,
    audioTrimming: false,
    apiAccess: false,
    exportEnabled: false,
    reviewQueueAccess: false,
  },
  PRO: {
    conversationsEnabled: true,
    audioTrimming: true,
    apiAccess: false,
    exportEnabled: false,
    reviewQueueAccess: false,
  },
  TEAM: {
    conversationsEnabled: true,
    audioTrimming: true,
    apiAccess: true,
    exportEnabled: true,
    reviewQueueAccess: true,
  },
  ENTERPRISE: {
    conversationsEnabled: true,
    audioTrimming: true,
    apiAccess: true,
    exportEnabled: true,
    reviewQueueAccess: true,
  },
};

export function getTierFeatures(tier?: TierName | null): UsageData['features'] {
  if (!tier) {
    return FEATURE_FLAGS.FREE;
  }

  return FEATURE_FLAGS[tier] ?? FEATURE_FLAGS.FREE;
}
