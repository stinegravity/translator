import { Request, Response } from 'express';
import { logger } from '../infrastructure/logger';
import { appFeedbackRepository } from '../repositories/appFeedbackRepository';
import type { AuthenticatedRequest } from '../middleware/auth';

export class AppFeedbackController {
  private getUser(req: Request) {
    return (req as AuthenticatedRequest).user;
  }

  submit = async (req: Request, res: Response) => {
    try {
      const user = this.getUser(req);
      const {
        overallRating,
        performanceRating,
        reliabilityRating,
        easeRating,
        notes,
        currentPath,
      } = req.body as {
        overallRating: number;
        performanceRating: number;
        reliabilityRating: number;
        easeRating: number;
        notes?: string;
        currentPath?: string;
      };

      const feedback = await appFeedbackRepository.submit({
        userId: user?.id,
        overallRating,
        performanceRating,
        reliabilityRating,
        easeRating,
        notes,
        currentPath,
      });

      res.status(201).json({ feedback });
    } catch (err) {
      logger.error({ err }, 'Submit app feedback error');
      res.status(500).json({ error: 'Failed to save app feedback' });
    }
  };

  list = async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
      const items = await appFeedbackRepository.list(limit);
      res.json({ items });
    } catch (err) {
      logger.error({ err }, 'List app feedback error');
      res.status(500).json({ error: 'Failed to load app feedback' });
    }
  };
}

export const appFeedbackController = new AppFeedbackController();
