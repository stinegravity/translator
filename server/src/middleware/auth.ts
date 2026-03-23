import { Request, Response, NextFunction } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../infrastructure/auth';
import { logger } from '../infrastructure/logger';
import type { TierName } from '../config/tiers';
import { isTierAtLeast } from '../config/tiers';
import { canAccessPortal, canManageInternalAccess, canSubmitReviewerFeedback } from '../utils/access';

export type InternalRole = 'CUSTOMER' | 'OPS' | 'ADMIN';
export type ReviewerAccessStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  tier: TierName;
  portalAccess: boolean;
  internalRole: InternalRole;
  reviewerAccess: boolean;
  reviewerAccessStatus: ReviewerAccessStatus;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  auth.api
    .getSession({ headers: fromNodeHeaders(req.headers) })
    .then((session) => {
      if (!session?.user) {
        logger.warn({ ip: req.ip, path: req.path }, 'Unauthenticated request rejected');
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const authReq = req as AuthenticatedRequest;
      const u = session.user as Record<string, unknown>;
      authReq.user = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        tier: (typeof u.tier === 'string' ? u.tier as TierName : 'FREE'),
        portalAccess: Boolean(u.portalAccess),
        internalRole: (typeof u.internalRole === 'string' ? u.internalRole as InternalRole : 'CUSTOMER'),
        reviewerAccess: Boolean(u.reviewerAccess),
        reviewerAccessStatus: (typeof u.reviewerAccessStatus === 'string' ? u.reviewerAccessStatus as ReviewerAccessStatus : 'NONE'),
      };

      next();
    })
    .catch((err) => {
      logger.error({ err }, 'Auth session validation failed');
      res.status(401).json({ error: 'Authentication required' });
    });
}

export function requireReviewerAccess(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (!canSubmitReviewerFeedback(authReq.user)) {
    res.status(403).json({
      error: 'Feedback submission is restricted to approved reviewers',
      reviewerAccessStatus: authReq.user.reviewerAccessStatus,
    });
    return;
  }

  next();
}

export function requireTier(minTier: TierName) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!isTierAtLeast(authReq.user.tier, minTier)) {
      res.status(403).json({
        error: `This feature requires a ${minTier} plan or higher`,
        requiredTier: minTier,
        currentTier: authReq.user.tier,
      });
      return;
    }

    next();
  };
}

export function requirePortalAccess(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (!canAccessPortal(authReq.user)) {
    res.status(403).json({
      error: 'Portal access is restricted to internal operations accounts',
    });
    return;
  }

  next();
}

export function requireInternalAdmin(req: Request, res: Response, next: NextFunction) {
  const authReq = req as AuthenticatedRequest;
  if (!authReq.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (!canManageInternalAccess(authReq.user)) {
    res.status(403).json({
      error: 'This action requires an internal admin account',
    });
    return;
  }

  next();
}
