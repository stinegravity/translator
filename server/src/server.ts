import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { logger } from './infrastructure/logger';
import { validateEnv } from './infrastructure/env';
import prisma from './infrastructure/db';
import redis from './infrastructure/redis';

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
