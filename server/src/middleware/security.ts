import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redis from '../infrastructure/redis';
import { logger } from '../infrastructure/logger';
import { TIER_LIMITS, type TierName } from '../config/tiers';
import type { AuthenticatedRequest } from './auth';
import type { Request, Response } from 'express';
import type { RedisCommandArgument } from 'ioredis';

const isProd = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

export const helmetMiddleware = helmet({
  contentSecurityPolicy: isProd
    ? {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          mediaSrc: ["'self'", 'blob:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      }
    : false,
  crossOriginEmbedderPolicy: false,
});

function createRedisStore(prefix: string) {
  return new RedisStore({
    sendCommand: async (...args: string[]) => {
      const command = args[0];
      const rest = args.slice(1);
      return redis.call(command, ...(rest as RedisCommandArgument[]));
    },
    prefix: `rl:${prefix}:`,
  });
}

function getUserKey(req: Request): string {
  const authReq = req as AuthenticatedRequest;
  if (authReq.user?.id) return `user:${authReq.user.id}`;
  return `ip:${req.ip}`;
}

function getUserTierLimit(req: Request): number {
  const authReq = req as AuthenticatedRequest;
  const tier: TierName = authReq.user?.tier || 'FREE';
  return TIER_LIMITS[tier]?.requestsPerMinute ?? 60;
}

// trust proxy is set on the app, so req.ip is already resolved — suppress IPv6 false positive
const noIpValidation = { keyGeneratorIpFallback: false as const };

export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: (req: Request) => getUserTierLimit(req),
  keyGenerator: (req: Request) => getUserKey(req),
  store: createRedisStore('api'),
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: noIpValidation,
  handler: (req: Request, res: Response, _next, options) => {
    logger.warn({ requestId: (req as { id?: string }).id, key: getUserKey(req), path: req.path }, 'Rate limit exceeded');
    res.status(options.statusCode ?? 429).json(options.message ?? { error: 'Too many requests, please try again later' });
  },
});

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyGenerator: (req: Request) => `ip:${req.ip}`,
  store: createRedisStore('auth'),
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: noIpValidation,
  handler: (req: Request, res: Response, _next, options) => {
    logger.warn({ ip: req.ip, path: req.path }, 'Auth rate limit exceeded');
    res.status(options.statusCode ?? 429).json(options.message ?? { error: 'Too many authentication attempts' });
  },
});

export const strictRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req: Request) => getUserKey(req),
  store: createRedisStore('strict'),
  message: { error: 'Too many requests' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: noIpValidation,
  handler: (req: Request, res: Response, _next, options) => {
    logger.warn({ requestId: (req as { id?: string }).id, key: getUserKey(req), path: req.path }, 'Strict rate limit exceeded');
    res.status(options.statusCode ?? 429).json(options.message ?? { error: 'Too many requests' });
  },
});
