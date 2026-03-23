import { describe, it, expect } from 'vitest';
import { canAccessPortal, canManageInternalAccess, canSubmitReviewerFeedback } from '../server/src/utils/access';

describe('canAccessPortal', () => {
  it('grants access to OPS role regardless of portalAccess flag', () => {
    expect(canAccessPortal({ internalRole: 'OPS', portalAccess: false })).toBe(true);
  });

  it('grants access to ADMIN role', () => {
    expect(canAccessPortal({ internalRole: 'ADMIN', portalAccess: false })).toBe(true);
  });

  it('grants access via portalAccess flag even for CUSTOMER', () => {
    expect(canAccessPortal({ internalRole: 'CUSTOMER', portalAccess: true })).toBe(true);
  });

  it('denies access to CUSTOMER without flag', () => {
    expect(canAccessPortal({ internalRole: 'CUSTOMER', portalAccess: false })).toBe(false);
  });

  it('handles undefined internalRole', () => {
    expect(canAccessPortal({ portalAccess: true })).toBe(true);
    expect(canAccessPortal({})).toBe(false);
  });
});

describe('canManageInternalAccess', () => {
  it('only ADMIN can manage', () => {
    expect(canManageInternalAccess({ internalRole: 'ADMIN' })).toBe(true);
    expect(canManageInternalAccess({ internalRole: 'OPS' })).toBe(false);
    expect(canManageInternalAccess({ internalRole: 'CUSTOMER' })).toBe(false);
  });

  it('undefined role cannot manage', () => {
    expect(canManageInternalAccess({})).toBe(false);
  });
});

describe('canSubmitReviewerFeedback', () => {
  it('requires both reviewerAccess and APPROVED status', () => {
    expect(canSubmitReviewerFeedback({ reviewerAccess: true, reviewerAccessStatus: 'APPROVED' })).toBe(true);
  });

  it('denies if not approved', () => {
    expect(canSubmitReviewerFeedback({ reviewerAccess: true, reviewerAccessStatus: 'PENDING' })).toBe(false);
    expect(canSubmitReviewerFeedback({ reviewerAccess: true, reviewerAccessStatus: 'REJECTED' })).toBe(false);
    expect(canSubmitReviewerFeedback({ reviewerAccess: true, reviewerAccessStatus: 'NONE' })).toBe(false);
  });

  it('denies if reviewerAccess is false even with APPROVED status', () => {
    expect(canSubmitReviewerFeedback({ reviewerAccess: false, reviewerAccessStatus: 'APPROVED' })).toBe(false);
  });
});
