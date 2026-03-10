import Redis from 'ioredis';
import { logger } from './logger';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redis = new Redis(redisUrl);

redis.on('error', (err) => logger.error({ err }, 'Redis error'));
redis.on('connect', () => logger.debug('Redis connected'));

export default redis;
