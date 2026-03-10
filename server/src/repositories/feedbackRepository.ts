import prisma from '../infrastructure/db';

export interface SubmitFeedbackInput {
  historyId: string;
  rating: 1 | 2 | 3;           // 1=incorrect, 2=ok, 3=good
  correction?: string;          // human-corrected translation
  dialect?: string;
  domain?: string;
  notes?: string;
  source: string;               // original input text
  aiOutput: string;             // what the AI produced
  reviewerEmail?: string;
}

export class FeedbackRepository {
  async submit(data: SubmitFeedbackInput) {
    return prisma.translationFeedback.create({
      data: {
        historyId: data.historyId,
        rating: data.rating,
        correction: data.correction?.trim() || null,
        dialect: data.dialect || null,
        domain: data.domain || null,
        notes: data.notes?.trim() || null,
        source: data.source,
        aiOutput: data.aiOutput,
        reviewerEmail: data.reviewerEmail || null,
      },
    });
  }

  async getForHistory(historyId: string) {
    return prisma.translationFeedback.findMany({
      where: { historyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Fetch the review queue — translations marked as bad or OK
   * that have no human correction yet. This is the queue for
   * native speaker reviewers to work through.
   */
  async getReviewQueue(opts: {
    dialect?: string;
    domain?: string;
    limit?: number;
    onlyNeedsCorrection?: boolean;
  } = {}) {
    const { dialect, domain, limit = 50, onlyNeedsCorrection = true } = opts;
    return prisma.translationFeedback.findMany({
      where: {
        ...(onlyNeedsCorrection ? { rating: { lte: 2 }, correction: null } : {}),
        ...(dialect ? { dialect } : {}),
        ...(domain ? { domain } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: {
        history: {
          select: {
            id: true,
            input: true,
            output: true,
            source: true,
            target: true,
            mode: true,
          },
        },
      },
    });
  }

  /**
   * Stats for the data flywheel dashboard:
   * how many good/ok/bad ratings, how many corrections collected.
   */
  async getStats(dialect?: string) {
    const where = dialect ? { dialect } : {};
    const [total, good, ok, bad, corrected] = await Promise.all([
      prisma.translationFeedback.count({ where }),
      prisma.translationFeedback.count({ where: { ...where, rating: 3 } }),
      prisma.translationFeedback.count({ where: { ...where, rating: 2 } }),
      prisma.translationFeedback.count({ where: { ...where, rating: 1 } }),
      prisma.translationFeedback.count({ where: { ...where, correction: { not: null } } }),
    ]);
    return { total, good, ok, bad, corrected };
  }

  /**
   * Export all feedback with corrections as JSONL for fine-tuning.
   * Format: { prompt, completion } pairs ready for OpenAI fine-tune.
   */
  async exportFineTuneData(opts: { dialect?: string; minRating?: number } = {}) {
    const { dialect, minRating = 3 } = opts;
    const rows = await prisma.translationFeedback.findMany({
      where: {
        rating: { gte: minRating },
        OR: [
          { correction: { not: null } },
          { rating: 3 },
        ],
        ...(dialect ? { dialect } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((row) => ({
      messages: [
        {
          role: 'system',
          content: `You are a professional translator specializing in ${row.dialect || 'Twi'} (Ghanaian language). Translate accurately and naturally.`,
        },
        {
          role: 'user',
          content: `Translate: "${row.source}"`,
        },
        {
          role: 'assistant',
          content: row.correction || row.aiOutput,
        },
      ],
    }));
  }
}

export const feedbackRepository = new FeedbackRepository();
