import type { ReviewerAccessStatus, TierName } from '../types';

export function shouldShowReviewerAccessBanner(tier?: TierName, reviewerAccessStatus?: ReviewerAccessStatus) {
  if (!tier) return false;
  if (tier === 'FREE') return false;
  return reviewerAccessStatus !== 'APPROVED';
}
