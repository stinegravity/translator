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

export const schemas = {
  translate: z.object({
    text: trimmedString(100_000),
    direction: genericDirection.default('tw-en'),
    folderId: z.string().cuid().optional(),
    conversationId: z.string().cuid().optional(),
    dialect: z.string().max(50).optional(),
    context: z
      .string()
      .max(50)
      .optional()
      .transform((s) => (s ? sanitizeString(s) : undefined)),
  }),

  transcribe: z.object({
    direction: genericDirection.default('tw-en'),
    folderId: z.string().cuid().optional(),
    conversationId: z.string().cuid().optional(),
    dialect: z.string().max(50).optional(),
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
    dialect: z.string().max(50).optional(),
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
    context: z.string().max(50).optional(),
    dialect: z.string().max(50).optional(),
  }),

  saveSettings: z.object({
    preferredDirection: genericDirection.optional(),
    preferredInputMode: z.enum(['text', 'audio']).optional(),
    diarizationEnabled: z.boolean().optional(),
  }),

  listConversations: z.object({
    folderId: z.string().cuid().optional(),
  }),

  createConversation: z.object({
    title: z.string().max(120).optional(),
    folderId: z.string().cuid().optional(),
  }),

  updateConversation: z.object({
    title: trimmedString(120),
  }),

  conversationParams: z.object({
    id: z.string().cuid(),
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
};
