import { describe, it, expect } from 'vitest';
import { canAccessPortal, canManageInternalAccess, canSubmitReviewerFeedback } from '../server/src/utils/access';
import { shouldShowReviewerAccessBanner } from '../src/lib/reviewerAccess';

describe('access-policy (legacy)', () => {
  it('portal access is granted to OPS and ADMIN internal roles', () => {
    expect(canAccessPortal({ internalRole: 'OPS', portalAccess: false })).toBe(true);
    expect(canAccessPortal({ internalRole: 'ADMIN', portalAccess: false })).toBe(true);
  });

  it('portal access can still be granted by compatibility flag', () => {
    expect(canAccessPortal({ internalRole: 'CUSTOMER', portalAccess: true })).toBe(true);
  });

  it('portal access is denied to normal customers without portal access', () => {
    expect(canAccessPortal({ internalRole: 'CUSTOMER', portalAccess: false })).toBe(false);
  });

  it('only internal admins can manage internal access', () => {
    expect(canManageInternalAccess({ internalRole: 'ADMIN' })).toBe(true);
    expect(canManageInternalAccess({ internalRole: 'OPS' })).toBe(false);
    expect(canManageInternalAccess({ internalRole: 'CUSTOMER' })).toBe(false);
  });

  it('reviewer feedback requires approved reviewer access', () => {
    expect(canSubmitReviewerFeedback({ reviewerAccess: true, reviewerAccessStatus: 'APPROVED' })).toBe(true);
    expect(canSubmitReviewerFeedback({ reviewerAccess: true, reviewerAccessStatus: 'PENDING' })).toBe(false);
    expect(canSubmitReviewerFeedback({ reviewerAccess: false, reviewerAccessStatus: 'APPROVED' })).toBe(false);
  });

  it('reviewer access banner only appears for paid non-approved users', () => {
    expect(shouldShowReviewerAccessBanner('FREE', 'NONE')).toBe(false);
    expect(shouldShowReviewerAccessBanner('PRO', 'NONE')).toBe(true);
    expect(shouldShowReviewerAccessBanner('TEAM', 'PENDING')).toBe(true);
    expect(shouldShowReviewerAccessBanner('ENTERPRISE', 'APPROVED')).toBe(false);
  });
});
