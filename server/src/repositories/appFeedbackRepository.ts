import prisma from '../infrastructure/db';

export interface SubmitAppFeedbackInput {
  userId?: string;
  overallRating: number;
  performanceRating: number;
  reliabilityRating: number;
  easeRating: number;
  notes?: string;
  currentPath?: string;
}

export class AppFeedbackRepository {
  async submit(data: SubmitAppFeedbackInput) {
    return prisma.appFeedback.create({
      data: {
        userId: data.userId,
        overallRating: data.overallRating,
        performanceRating: data.performanceRating,
        reliabilityRating: data.reliabilityRating,
        easeRating: data.easeRating,
        notes: data.notes?.trim() || null,
        currentPath: data.currentPath?.trim() || null,
      },
    });
  }

  async list(limit = 50) {
    return prisma.appFeedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            email: true,
            name: true,
            tier: true,
          },
        },
      },
    });
  }
}

export const appFeedbackRepository = new AppFeedbackRepository();
