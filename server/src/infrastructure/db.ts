// Env loading is handled by server.ts entrypoint — do not duplicate here.
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Prisma 7 with driver adapter. Uses lazy initialization to ensure
 * DATABASE_URL is available (dotenv must run before first access in ESM).
 *
 * Connection pool size is configured via DB_POOL_SIZE env var (default: 10).
 * For production with expected concurrency, tune this based on:
 *   max_connections / number_of_app_instances
 */
let _prisma: PrismaClient | null = null;

function getPrisma(): PrismaClient {
  if (!_prisma) {
    const connectionString = process.env.DATABASE_URL;
    const poolSize = parseInt(process.env.DB_POOL_SIZE || '10', 10);
    const adapter = new PrismaPg({ connectionString, poolSize });
    _prisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }
  return _prisma;
}

const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrisma(), prop, receiver);
  },
});

export default prisma;
