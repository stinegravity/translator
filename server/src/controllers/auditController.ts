import { Request, Response } from 'express';
import prisma from '../infrastructure/db';
import { logger } from '../infrastructure/logger';

export const auditController = {
  getLogs: async (req: Request, res: Response) => {
    try {
      const { limit = 50, offset = 0, action } = req.query;
      const take = Math.min(Number(limit) || 50, 200);
      const skip = Number(offset) || 0;
      const where = action ? { action: action as string } : {};

      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take,
          skip,
        }),
        prisma.auditLog.count({ where }),
      ]);

      res.json({ logs, total });
    } catch (err) {
      logger.error({ err }, 'Failed to fetch audit logs');
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  }
};
