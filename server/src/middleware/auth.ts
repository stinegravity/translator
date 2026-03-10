import { Request, Response, NextFunction } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../infrastructure/auth';
import { logger } from '../infrastructure/logger';
import type { TierName } from '../config/tiers';
import { isTierAtLeast } from '../config/tiers';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  tier: TierName;
}

export interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  auth.api
    .getSession({ headers: fromNodeHeaders(req.headers) })
    .then((session) => {
      if (!session?.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const authReq = req as AuthenticatedRequest;
      authReq.user = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        tier: ((session.user as Record<string, unknown>).tier as TierName) || 'FREE',
      };

      next();
    })
    .catch((err) => {
      logger.error({ err }, 'Auth session validation failed');
      res.status(401).json({ error: 'Authentication required' });
    });
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
