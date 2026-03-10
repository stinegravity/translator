import redis from '../infrastructure/redis';
import { logger } from '../infrastructure/logger';

export class CacheService {
  private readonly defaultExpiry = 3600 * 24; // 24 hours

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      logger.warn({ err, key }, 'Cache get failed');
      return null;
    }
  }

  async set<T>(key: string, value: T, expirySeconds = this.defaultExpiry): Promise<void> {
    try {
      const data = JSON.stringify(value);
      await redis.set(key, data, 'EX', expirySeconds);
    } catch (err) {
      logger.warn({ err, key }, 'Cache set failed');
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (err) {
      logger.warn({ err, key }, 'Cache delete failed');
    }
  }

  generateKey(...parts: string[]): string {
    return parts.join(':').toLowerCase();
  }
}

export const cacheService = new CacheService();
