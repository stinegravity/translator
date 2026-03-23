import { Request, Response, NextFunction } from 'express';
import { logger } from '../infrastructure/logger';
import { Sentry } from '../infrastructure/sentry';

interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(err: AppError, req: Request, res: Response, next: NextFunction) {
  void next;
  const statusCode = err.statusCode ?? 500;
  const message = statusCode >= 500 ? 'Internal server error' : (err.message ?? 'Unknown error');

  if (statusCode >= 500) {
    logger.error({ err, requestId: req.id }, 'Unhandled error');
    Sentry.captureException(err);
  }

  res.status(statusCode).json({
    error: message,
    ...(statusCode >= 500 && req.id ? { requestId: req.id } : {}),
  });
}
