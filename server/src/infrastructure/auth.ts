import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import prisma from './db';
import { logger } from './logger';
import { notifyPasswordReset, notifyEmailVerification } from './notifications';

const rawBaseURL = process.env.BETTER_AUTH_URL || 'http://localhost:3001';
const baseURL = rawBaseURL.replace(/['"]/g, '');
const isProd = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging';

const devOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:3001',
];

const envOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean) ?? [];
const baseOrigin = baseURL ? new URL(baseURL).origin : '';
const prodOrigins = [...new Set([baseOrigin, ...envOrigins])].filter(Boolean);
const devOriginsFull = [...new Set([...devOrigins, ...envOrigins])];

/**
 * trustedOrigins as function: when request has no Origin (e.g. health checks, curl),
 * return our origins so the check can pass. Avoids "Missing or null Origin" errors.
 */
const trustedOriginsFn = (): string[] => {
  const origins = isProd ? prodOrigins : devOriginsFull;
  if (origins.length === 0 && baseOrigin) return [baseOrigin];
  return origins;
};

export const auth = betterAuth({
  basePath: '/api/auth',
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  trustedOrigins: trustedOriginsFn,
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    sendResetPassword: async ({ user, url }) => {
      notifyPasswordReset(user, url);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      notifyEmailVerification(user, url);
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieOptions: {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'strict' as const : 'lax' as const,
      path: '/',
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['credential'],
    },
  },
  user: {
    additionalFields: {
      tier: {
        type: 'string',
        defaultValue: 'FREE',
        input: false,
      },
      portalAccess: {
        type: 'boolean',
        defaultValue: false,
        input: false,
      },
      internalRole: {
        type: 'string',
        defaultValue: 'CUSTOMER',
        input: false,
      },
      reviewerAccess: {
        type: 'boolean',
        defaultValue: false,
        input: false,
      },
      reviewerAccessStatus: {
        type: 'string',
        defaultValue: 'NONE',
        input: false,
      },
      tierExpiresAt: {
        type: 'date',
        required: false,
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        async before(user) {
          const existing = await prisma.user.findUnique({
            where: { email: user.email },
          });
          if (existing) {
            logger.info({ email: user.email, existingId: existing.id }, 'Linking new auth account to existing user');
            return { data: { ...user, id: existing.id } };
          }
          return { data: user };
        },
      },
    },
  },
  advanced: {
    useRuntimeBaseURL: true,
    cookiePrefix: 'kyerease',
    generateId: () => {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let id = '';
      const bytes = new Uint8Array(25);
      crypto.getRandomValues(bytes);
      for (const b of bytes) id += chars[b % chars.length];
      return id;
    },
  },
  logger: {
    disabled: false,
    level: process.env.NODE_ENV === 'production' ? 'error' : 'debug',
    log(level, message, ...args) {
      const meta = args.length ? args[0] : undefined;
      if (level === 'error') logger.error(meta, `[auth] ${message}`);
      else if (level === 'warn') logger.warn(meta, `[auth] ${message}`);
      else logger.debug(meta, `[auth] ${message}`);
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
