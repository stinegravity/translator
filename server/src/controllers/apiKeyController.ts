import { Request, Response } from 'express';
import { apiKeyRepository } from '../repositories/apiKeyRepository';
import type { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../infrastructure/logger';

export const apiKeyController = {
  async list(req: Request, res: Response) {
    const { user } = req as AuthenticatedRequest;
    try {
      const keys = await apiKeyRepository.list(user.id);
      res.json({ keys });
    } catch (err) {
      logger.error({ err }, 'List API keys error');
      res.status(500).json({ error: 'Failed to list API keys' });
    }
  },

  async create(req: Request, res: Response) {
    const { user } = req as AuthenticatedRequest;
    const { name, expiresInDays } = req.body as { name: string; expiresInDays?: number };

    try {
      const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : undefined;

      const result = await apiKeyRepository.create(user.id, name, expiresAt);
      res.status(201).json({
        key: result.key, // Only returned at creation
        id: result.id,
        name: result.name,
        keyPrefix: result.keyPrefix,
        expiresAt: result.expiresAt,
        createdAt: result.createdAt,
      });
    } catch (err) {
      logger.error({ err }, 'Create API key error');
      res.status(500).json({ error: 'Failed to create API key' });
    }
  },

  async revoke(req: Request, res: Response) {
    const { user } = req as AuthenticatedRequest;
    const { id } = req.params;

    try {
      const result = await apiKeyRepository.revoke(id, user.id);
      if (result.count === 0) {
        res.status(404).json({ error: 'API key not found' });
        return;
      }
      res.json({ success: true });
    } catch (err) {
      logger.error({ err }, 'Revoke API key error');
      res.status(500).json({ error: 'Failed to revoke API key' });
    }
  },
};
