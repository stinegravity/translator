// Env loading is handled by server.ts entrypoint — do not duplicate here.
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Prisma 7 with driver adapter. Use connectionString format (not pool) per Prisma 7 docs
 * to avoid P2022 ColumnNotFound issues.
 *
 * Connection pool size is configured via DB_POOL_SIZE env var (default: 10).
 * For production with expected concurrency, tune this based on:
 *   max_connections / number_of_app_instances
 */
const connectionString = process.env.DATABASE_URL;
const poolSize = parseInt(process.env.DB_POOL_SIZE || '10', 10);
const adapter = new PrismaPg({ connectionString, poolSize });

const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export default prisma;
