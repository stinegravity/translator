import { Request, Response } from 'express';
import prisma from '../infrastructure/db';
import { logger } from '../infrastructure/logger';
import type { AuthenticatedRequest } from '../middleware/auth';

type InternalRole = 'CUSTOMER' | 'OPS' | 'ADMIN';

function hasPortalAccess(internalRole: InternalRole) {
  return internalRole === 'OPS' || internalRole === 'ADMIN';
}

export const internalUserController = {
  list: async (req: Request, res: Response) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 100, 500);
      const offset = Number(req.query.offset) || 0;
      const items = await prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          email: true,
          name: true,
          tier: true,
          portalAccess: true,
          internalRole: true,
          createdAt: true,
        },
      });

      res.json({ items });
    } catch (err) {
      logger.error({ err }, 'List internal users error');
      res.status(500).json({ error: 'Failed to load internal users' });
    }
  },

  update: async (req: Request, res: Response) => {
    try {
      const { id } = req.params as { id: string };
      const { internalRole } = req.body as { internalRole: InternalRole };
      const admin = (req as AuthenticatedRequest).user;

      const user = await prisma.user.update({
        where: { id },
        data: {
          internalRole,
          portalAccess: hasPortalAccess(internalRole),
        },
        select: {
          id: true,
          email: true,
          name: true,
          tier: true,
          portalAccess: true,
          internalRole: true,
          createdAt: true,
        },
      });

      // Invalidate all sessions for this user so new permissions take effect immediately
      await prisma.session.deleteMany({ where: { userId: id } });

      logger.info(
        { targetUserId: id, newRole: internalRole, adminUserId: admin.id, adminEmail: admin.email },
        'User role updated — sessions invalidated'
      );

      res.json({ user });
    } catch (err) {
      logger.error({ err }, 'Update internal user error');
      res.status(500).json({ error: 'Failed to update internal user' });
    }
  },
};
