import redis from '../infrastructure/redis';
import { logger } from '../infrastructure/logger';

export class CacheService {
  private readonly defaultExpiry = 3600 * 24; // 24 hours
  private readonly inflight = new Map<string, Promise<unknown>>();

  /**
   * Get-or-compute with single-flight deduplication.
   * Only one call to `compute` runs per key at a time; concurrent callers share the result.
   */
  async getOrCompute<T>(key: string, compute: () => Promise<T>, expirySeconds = this.defaultExpiry): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = compute().then(async (value) => {
      await this.set(key, value, expirySeconds);
      return value;
    }).finally(() => {
      this.inflight.delete(key);
    });

    this.inflight.set(key, promise);
    return promise;
  }

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
