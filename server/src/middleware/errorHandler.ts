import { Request, Response, NextFunction } from 'express';
import { logger } from '../infrastructure/logger';

interface AppError extends Error {
  statusCode?: number;
}

export function errorHandler(err: AppError, req: Request, res: Response, next: NextFunction) {
  void next;
  const statusCode = err.statusCode ?? 500;
  const message = statusCode >= 500 ? 'Internal server error' : (err.message ?? 'Unknown error');

  if (statusCode >= 500) {
    logger.error({ err, requestId: req.id }, 'Unhandled error');
  }

  res.status(statusCode).json({ error: message });
}
