import { Request, Response } from 'express';
import { feedbackRepository } from '../repositories/feedbackRepository';
import { logger } from '../infrastructure/logger';
import type { AuthenticatedRequest } from '../middleware/auth';

export class FeedbackController {
  private getUser(req: Request) {
    return (req as AuthenticatedRequest).user;
  }

  submit = async (req: Request, res: Response) => {
    try {
      const {
        historyId,
        rating,
        correction,
        dialect,
        domain,
        notes,
        source,
        aiOutput,
      } = req.body as {
        historyId: string;
        rating: 1 | 2 | 3;
        correction?: string;
        dialect?: string;
        domain?: string;
        notes?: string;
        source: string;
        aiOutput: string;
      };

      if (!historyId || !source || !aiOutput || ![1, 2, 3].includes(rating)) {
        return res.status(400).json({ error: 'historyId, source, aiOutput, and rating (1-3) are required' });
      }

      const user = this.getUser(req);
      const feedback = await feedbackRepository.submit({
        historyId,
        rating,
        correction,
        dialect,
        domain,
        notes,
        source,
        aiOutput,
        reviewerEmail: user?.email,
      });

      logger.info({ historyId, rating, dialect }, 'Translation feedback submitted');
      res.status(201).json({ feedback });
    } catch (err) {
      logger.error({ err }, 'Submit feedback error');
      res.status(500).json({ error: 'Failed to save feedback' });
    }
  };

  getForHistory = async (req: Request, res: Response) => {
    try {
      const { historyId } = req.params as { historyId: string };
      const items = await feedbackRepository.getForHistory(historyId);
      res.json({ items });
    } catch (err) {
      logger.error({ err }, 'Get feedback error');
      res.status(500).json({ error: 'Failed to load feedback' });
    }
  };

  getStats = async (req: Request, res: Response) => {
    try {
      const dialect = typeof req.query.dialect === 'string' ? req.query.dialect : undefined;
      const stats = await feedbackRepository.getStats(dialect);
      res.json({ stats });
    } catch (err) {
      logger.error({ err }, 'Feedback stats error');
      res.status(500).json({ error: 'Failed to load stats' });
    }
  };

  getReviewQueue = async (req: Request, res: Response) => {
    try {
      const dialect = typeof req.query.dialect === 'string' ? req.query.dialect : undefined;
      const domain = typeof req.query.domain === 'string' ? req.query.domain : undefined;
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
      const items = await feedbackRepository.getReviewQueue({ dialect, domain, limit, onlyNeedsCorrection: true });
      res.json({ items });
    } catch (err) {
      logger.error({ err }, 'Review queue error');
      res.status(500).json({ error: 'Failed to load review queue' });
    }
  };

  exportFineTuneData = async (req: Request, res: Response) => {
    try {
      const dialect = typeof req.query.dialect === 'string' ? req.query.dialect : undefined;
      const minRating = parseInt(req.query.minRating as string, 10) || 3;
      const data = await feedbackRepository.exportFineTuneData({ dialect, minRating });

      res.setHeader('Content-Type', 'application/x-ndjson');
      res.setHeader('Content-Disposition', `attachment; filename="kyerease-finetune-${dialect ?? 'all'}.jsonl"`);
      res.send(data.map((d: { messages: object[] }) => JSON.stringify(d)).join('\n'));
    } catch (err) {
      logger.error({ err }, 'Fine-tune export error');
      res.status(500).json({ error: 'Failed to export fine-tune data' });
    }
  };
}

export const feedbackController = new FeedbackController();
