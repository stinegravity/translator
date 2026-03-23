import { Request, Response } from 'express';
import prisma from '../infrastructure/db';
import { logger } from '../infrastructure/logger';
import { notifyReviewerApplicationSubmitted, notifyReviewerDecision } from '../infrastructure/notifications';
import type { AuthenticatedRequest } from '../middleware/auth';

export const reviewerAccessController = {
  submitRequest: async (req: Request, res: Response) => {
    try {
      const user = (req as AuthenticatedRequest).user;
      const {
        organization,
        roleTitle,
        languages,
        credentials,
        reviewUseCase,
        portfolioUrl,
        notes,
      } = req.body as {
        organization?: string;
        roleTitle?: string;
        languages?: string;
        credentials: string;
        reviewUseCase?: string;
        portfolioUrl?: string;
        notes?: string;
      };

      const existingPending = await prisma.reviewerApplication.findFirst({
        where: { userId: user.id, status: 'PENDING' },
        select: { id: true },
      });

      if (existingPending) {
        res.status(409).json({ error: 'A reviewer access request is already pending' });
        return;
      }

      const application = await prisma.$transaction(async (tx) => {
        const created = await tx.reviewerApplication.create({
          data: {
            userId: user.id,
            organization: organization?.trim() || null,
            roleTitle: roleTitle?.trim() || null,
            languages: languages?.trim() || null,
            credentials: credentials.trim(),
            reviewUseCase: reviewUseCase?.trim() || null,
            portfolioUrl: portfolioUrl?.trim() || null,
            notes: notes?.trim() || null,
            status: 'PENDING',
          },
        });

        await tx.user.update({
          where: { id: user.id },
          data: {
            reviewerAccess: false,
            reviewerAccessStatus: 'PENDING',
          },
        });

        return created;
      });

      notifyReviewerApplicationSubmitted(
        { email: user.email, name: user.name },
        application.id,
      );

      res.status(201).json({ application });
    } catch (err) {
      logger.error({ err }, 'Submit reviewer application error');
      res.status(500).json({ error: 'Failed to submit reviewer access request' });
    }
  },

  listRequests: async (req: Request, res: Response) => {
    try {
      const status = typeof req.query.status === 'string' ? req.query.status : undefined;
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
      const items = await prisma.reviewerApplication.findMany({
        where: status ? { status: status as 'PENDING' | 'APPROVED' | 'REJECTED' } : {},
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              tier: true,
              reviewerAccess: true,
              reviewerAccessStatus: true,
            },
          },
        },
      });

      res.json({ items });
    } catch (err) {
      logger.error({ err }, 'List reviewer applications error');
      res.status(500).json({ error: 'Failed to load reviewer requests' });
    }
  },

  reviewRequest: async (req: Request, res: Response) => {
    try {
      const reviewer = (req as AuthenticatedRequest).user;
      const { id } = req.params as { id: string };
      const { status, reviewerDecisionNotes } = req.body as {
        status: 'APPROVED' | 'REJECTED';
        reviewerDecisionNotes?: string;
      };

      const application = await prisma.reviewerApplication.findUnique({
        where: { id },
        select: { id: true, userId: true },
      });

      if (!application) {
        res.status(404).json({ error: 'Reviewer request not found' });
        return;
      }

      const updated = await prisma.$transaction(async (tx) => {
        const nextApplication = await tx.reviewerApplication.update({
          where: { id },
          data: {
            status,
            reviewerDecisionNotes: reviewerDecisionNotes?.trim() || null,
            reviewedAt: new Date(),
            reviewedByUserId: reviewer.id,
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                name: true,
                tier: true,
                reviewerAccess: true,
                reviewerAccessStatus: true,
              },
            },
          },
        });

        await tx.user.update({
          where: { id: application.userId },
          data: {
            reviewerAccess: status === 'APPROVED',
            reviewerAccessStatus: status,
          },
        });

        return nextApplication;
      });

      notifyReviewerDecision(
        { email: updated.user.email, name: updated.user.name },
        status,
        reviewerDecisionNotes,
      );

      res.json({ application: updated });
    } catch (err) {
      logger.error({ err }, 'Review reviewer application error');
      res.status(500).json({ error: 'Failed to review reviewer request' });
    }
  },
};
