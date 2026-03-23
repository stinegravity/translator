import dotenv from 'dotenv';
import path from 'path';

const envFile = process.env.NODE_ENV === 'staging' ? '.env.staging' : '.env';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

// Sentry must init before other imports to instrument them
import './infrastructure/sentry';

import app from './app';
import { logger } from './infrastructure/logger';
import { validateEnv } from './infrastructure/env';
import prisma from './infrastructure/db';
import redis from './infrastructure/redis';
import { transcriptionQueue } from './queues/transcriptionQueue';

validateEnv();

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, () => {
  logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'Server started');
});

async function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down gracefully');

  await new Promise<void>((resolve) => {
    server.close(() => {
      logger.info('HTTP server closed');
      resolve();
    });
  });

  try {
    await transcriptionQueue.close();
    await Promise.all([prisma.$disconnect(), redis.quit()]);
    logger.info('DB and Redis disconnected');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
