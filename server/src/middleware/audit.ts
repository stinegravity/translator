import { Request, Response, NextFunction } from 'express';
import { auditRepository } from '../repositories/auditRepository';
import { logger } from '../infrastructure/logger';
import type { AuthenticatedRequest } from './auth';

type RequestWithId = Request & { id?: string };

function getClientIp(req: Request): string {
  const forwarded = req.header('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket.remoteAddress ?? 'unknown';
}

function getAction(req: Request): string {
  const method = req.method;
  const path = req.path;
  if (path === '/translate' && method === 'POST') return 'translate';
  if (path === '/transcribe' && method === 'POST') return 'transcribe';
  if (path === '/transcribe-url' && method === 'POST') return 'transcribe_url';
  if (path === '/speak' && method === 'POST') return 'speak';
  if (path === '/history' && method === 'GET') return 'history_list';
  if (path.match(/^\/history\/[^/]+$/) && method === 'DELETE') return 'history_archive';
  if (path.match(/^\/history\/[^/]+\/transcript$/) && method === 'PATCH') return 'history_transcript_update';
  if (path === '/favorites' && method === 'GET') return 'favorites_list';
  if (path === '/favorites' && method === 'POST') return 'favorite_add';
  if (path.match(/^\/favorites\/[^/]+$/) && method === 'DELETE') return 'favorite_remove';
  if (path === '/settings' && method === 'GET') return 'settings_get';
  if (path === '/settings' && method === 'POST') return 'settings_save';
  if (path === '/exports' && method === 'GET') return 'exports_list';
  if (path.match(/^\/history\/[^/]+\/export$/) && method === 'POST') return 'history_export_create';
  if (path.match(/^\/conversations\/[^/]+\/export$/) && method === 'POST') return 'conversation_export_create';
  if (path.match(/^\/exports\/[^/]+\/download$/) && method === 'GET') return 'export_download';
  return `${method}:${path}`;
}

export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const authUser = (req as AuthenticatedRequest).user;
    auditRepository
      .log({
        action: getAction(req),
        userId: authUser?.id,
        userEmail: authUser?.email,
        resourceId: typeof req.params.historyId === 'string' ? req.params.historyId : undefined,
        ip: getClientIp(req),
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: duration,
        metadata: { requestId: (req as RequestWithId).id },
      })
      .catch((err) => logger.error({ err }, 'Audit log failed'));
  });

  next();
}
