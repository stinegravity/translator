import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest, AuthUser } from '../server/src/middleware/auth';

// We test the pure middleware functions that don't call betterAuth
// (requireTier, requirePortalAccess, requireInternalAdmin, requireReviewerAccess)
// These are imported after mocking betterAuth

vi.mock('../server/src/infrastructure/auth', () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock('../server/src/infrastructure/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const { requireTier, requirePortalAccess, requireInternalAdmin, requireReviewerAccess } = await import(
  '../server/src/middleware/auth'
);

function mockReqRes(user?: Partial<AuthUser>) {
  const req = { user: user ? { id: '1', email: 'a@b.com', name: 'A', tier: 'FREE', portalAccess: false, internalRole: 'CUSTOMER', reviewerAccess: false, reviewerAccessStatus: 'NONE', ...user } : undefined } as unknown as Request;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe('requireTier', () => {
  it('passes when user tier meets requirement', () => {
    const { req, res, next } = mockReqRes({ tier: 'PRO' });
    requireTier('PRO')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('passes when user tier exceeds requirement', () => {
    const { req, res, next } = mockReqRes({ tier: 'ENTERPRISE' });
    requireTier('PRO')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 when tier is insufficient', () => {
    const { req, res, next } = mockReqRes({ tier: 'FREE' });
    requireTier('PRO')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when no user', () => {
    const { req, res, next } = mockReqRes();
    (req as AuthenticatedRequest).user = undefined as unknown as AuthUser;
    requireTier('PRO')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('requirePortalAccess', () => {
  it('passes for ADMIN internal role', () => {
    const { req, res, next } = mockReqRes({ internalRole: 'ADMIN' });
    requirePortalAccess(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('passes for OPS internal role', () => {
    const { req, res, next } = mockReqRes({ internalRole: 'OPS' });
    requirePortalAccess(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 for CUSTOMER without portal access', () => {
    const { req, res, next } = mockReqRes({ internalRole: 'CUSTOMER', portalAccess: false });
    requirePortalAccess(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('passes for CUSTOMER with portalAccess flag', () => {
    const { req, res, next } = mockReqRes({ internalRole: 'CUSTOMER', portalAccess: true });
    requirePortalAccess(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('requireInternalAdmin', () => {
  it('passes for ADMIN', () => {
    const { req, res, next } = mockReqRes({ internalRole: 'ADMIN' });
    requireInternalAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 for OPS', () => {
    const { req, res, next } = mockReqRes({ internalRole: 'OPS' });
    requireInternalAdmin(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('requireReviewerAccess', () => {
  it('passes for approved reviewer', () => {
    const { req, res, next } = mockReqRes({ reviewerAccess: true, reviewerAccessStatus: 'APPROVED' });
    requireReviewerAccess(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 403 for pending reviewer', () => {
    const { req, res, next } = mockReqRes({ reviewerAccess: true, reviewerAccessStatus: 'PENDING' });
    requireReviewerAccess(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
