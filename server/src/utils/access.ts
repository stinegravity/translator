import type { InternalRole, ReviewerAccessStatus } from '../middleware/auth';

export function canAccessPortal(input: { portalAccess?: boolean; internalRole?: InternalRole | null }) {
  return Boolean(input.portalAccess || input.internalRole === 'OPS' || input.internalRole === 'ADMIN');
}

export function canManageInternalAccess(input: { internalRole?: InternalRole | null }) {
  return input.internalRole === 'ADMIN';
}

export function canSubmitReviewerFeedback(input: { reviewerAccess?: boolean; reviewerAccessStatus?: ReviewerAccessStatus | null }) {
  return Boolean(input.reviewerAccess) && input.reviewerAccessStatus === 'APPROVED';
}
