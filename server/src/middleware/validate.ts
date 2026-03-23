import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError, type ZodIssue } from 'zod';
import { logger } from '../infrastructure/logger';

type ValidateSource = 'body' | 'query' | 'params';

class ValidationError extends Error {
  statusCode = 400;
}

const sanitizeString = (s: string) => s.trim().replace(/[\x00-\x1F\x7F]/g, '');

export function validate(schema: ZodSchema, source: ValidateSource = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const data = req[source];
    try {
      const parsed = schema.parse(data);
      const requestRecord = req as Request & Record<string, unknown>;
      requestRecord[`_validated_${source}`] = parsed;
      const requestSource = req[source];
      if (requestSource && typeof requestSource === 'object') {
        Object.assign(requestSource, parsed);
      }
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const issues: ZodIssue[] = err.issues;
        const messages = issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
        logger.warn({ err: issues }, 'Validation failed');
        const validationErr = new ValidationError(`Validation failed: ${messages.join('; ')}`);
        return next(validationErr);
      }
      next(err);
    }
  };
}

const trimmedString = (max: number) =>
  z
    .string()
    .transform((s) => sanitizeString(s))
    .pipe(z.string().min(1).max(max));

const genericDirection = z.string().regex(/^[a-z]{2,3}-[a-z]{2,3}$/);

const allowedDialects = ['Asante Twi', 'Akuapem Twi', 'Fante', 'Akyem Twi', 'Bono', 'General Twi'] as const;
const allowedContexts = ['Casual', 'Formal', 'Business', 'Medical', 'News', 'Legal', 'Technical', 'Religious'] as const;

const dialectSchema = z.enum(allowedDialects).optional();
const contextSchema = z.enum(allowedContexts).optional();

export const schemas = {
  translate: z.object({
    text: trimmedString(100_000),
    direction: genericDirection.default('tw-en'),
    folderId: z.string().cuid().optional(),
    conversationId: z.string().cuid().optional(),
    dialect: dialectSchema,
    context: contextSchema,
  }),

  transcriptionJobId: z.object({
    jobId: z.string().min(1).max(50),
  }),

  transcribe: z.object({
    direction: genericDirection.default('tw-en'),
    folderId: z.string().cuid().optional(),
    conversationId: z.string().cuid().optional(),
    dialect: dialectSchema,
    diarize: z
      .union([z.boolean(), z.literal('true'), z.literal('false')])
      .optional()
      .transform((v) => v === true || v === 'true'),
  }),

  transcribeUrl: z.object({
    url: z.url().max(500),
    direction: genericDirection.default('tw-en'),
    folderId: z.string().cuid().optional(),
    conversationId: z.string().cuid().optional(),
    dialect: dialectSchema,
    diarize: z.boolean().optional(),
  }),

  speak: z.object({
    text: trimmedString(10_000),
  }),

  history: z.object({
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),

  addFavorite: z.object({
    historyId: z.string().cuid(),
  }),

  removeFavoriteParams: z.object({
    historyId: z.string().cuid(),
  }),

  historyItemParams: z.object({
    historyId: z.string().cuid(),
  }),

  updateHistoryTranscript: z.object({
    transcript: trimmedString(100_000),
    context: contextSchema,
    dialect: dialectSchema,
  }),

  saveSettings: z.object({
    preferredDirection: genericDirection.optional(),
    preferredInputMode: z.enum(['text', 'audio']).optional(),
    diarizationEnabled: z.boolean().optional(),
    preferredVoice: z.enum(['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer']).optional(),
  }),

  listConversations: z.object({
    folderId: z.string().cuid().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  }),
  listFavorites: z.object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  }),

  createConversation: z.object({
    title: z.string().max(120).optional(),
    folderId: z.string().cuid().optional(),
  }),

  updateConversation: z.object({
    title: trimmedString(120).optional(),
    folderId: z.string().cuid().nullable().optional(),
  }),

  conversationParams: z.object({
    id: z.string().cuid(),
  }),
  getConversation: z.object({
    limit: z.coerce.number().int().min(1).max(200).default(100),
    offset: z.coerce.number().int().min(0).default(0),
  }),

  createHistoryExport: z.object({
    format: z.enum(['txt', 'srt', 'vtt']),
  }),

  createConversationExport: z.object({
    format: z.literal('txt').default('txt'),
  }),

  exportParams: z.object({
    id: z.string().cuid(),
  }),

  submitAppFeedback: z.object({
    overallRating: z.number().int().min(1).max(5),
    performanceRating: z.number().int().min(1).max(5),
    reliabilityRating: z.number().int().min(1).max(5),
    easeRating: z.number().int().min(1).max(5),
    notes: z.string().max(1000).optional(),
    currentPath: z.string().max(200).optional(),
  }),

  listAppFeedback: z.object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
  }),

  internalUserParams: z.object({
    id: z.string().cuid(),
  }),

  updateInternalUser: z.object({
    internalRole: z.enum(['CUSTOMER', 'OPS', 'ADMIN']),
  }),

  submitReviewerApplication: z.object({
    organization: z.string().max(120).optional(),
    roleTitle: z.string().max(120).optional(),
    languages: z.string().max(200).optional(),
    credentials: trimmedString(2000),
    reviewUseCase: z.string().max(500).optional(),
    portfolioUrl: z.string().url().max(500).optional().or(z.literal('')),
    notes: z.string().max(1000).optional(),
  }),

  listReviewerApplications: z.object({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  }),

  reviewerApplicationParams: z.object({
    id: z.string().cuid(),
  }),

  reviewReviewerApplication: z.object({
    status: z.enum(['APPROVED', 'REJECTED']),
    reviewerDecisionNotes: z.string().max(1000).optional(),
  }),

  createApiKey: z.object({
    name: z.string().min(1).max(100),
    expiresInDays: z.number().int().min(1).max(365).optional(),
  }),

  apiKeyParams: z.object({
    id: z.string().cuid(),
  }),
};
