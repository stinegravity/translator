import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import prisma from './db';
import { logger } from './logger';
import { sendEmail } from './email';

const baseURL = process.env.BETTER_AUTH_URL || 'http://localhost:3001';
const appName = 'KyereAse';

export const auth = betterAuth({
  basePath: '/api/auth',
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    sendResetPassword: async ({ user, url }) => {
      void sendEmail({
        to: user.email,
        subject: `Reset your ${appName} password`,
        text: `Click the link to reset your password: ${url}\n\nThis link expires in 1 hour. If you didn't request this, you can ignore this email.`,
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2>Reset your password</h2>
            <p>Click the link below to reset your ${appName} password:</p>
            <p><a href="${url}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Reset password</a></p>
            <p style="color: #666; font-size: 14px;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      void sendEmail({
        to: user.email,
        subject: `Verify your ${appName} email`,
        text: `Click the link to verify your email address: ${url}\n\nIf you didn't create an account, you can ignore this email.`,
        html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2>Verify your email</h2>
            <p>Thanks for signing up for ${appName}. Click the link below to verify your email address:</p>
            <p><a href="${url}" style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify email</a></p>
            <p style="color: #666; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
          </div>
        `,
      }).catch((err) => logger.error({ err, email: user.email }, 'Verification email failed'));
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
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
