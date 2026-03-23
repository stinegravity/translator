import redis from '../infrastructure/redis';
import prisma from '../infrastructure/db';
import { logger } from '../infrastructure/logger';
import { getTierLimits, type TierName } from '../config/tiers';

export type UsageAction = 'translate' | 'transcribe' | 'tts';

class UsageLimitError extends Error {
  statusCode = 429;
  constructor(message: string) {
    super(message);
    this.name = 'UsageLimitError';
  }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function redisKey(userId: string, date: string, action: UsageAction): string {
  return `usage:${userId}:${date}:${action}`;
}

const ACTION_TO_LIMIT_KEY: Record<UsageAction, 'charsPerDay' | 'transcriptionsPerDay' | 'ttsPerDay'> = {
  translate: 'charsPerDay',
  transcribe: 'transcriptionsPerDay',
  tts: 'ttsPerDay',
};

const ACTION_TO_DB_FIELD: Record<UsageAction, string> = {
  translate: 'charsTranslated',
  transcribe: 'transcriptionCount',
  tts: 'ttsCount',
};

const ACTION_LABELS: Record<UsageAction, string> = {
  translate: 'translation characters',
  transcribe: 'transcriptions',
  tts: 'text-to-speech requests',
};

class UsageService {
  async checkLimit(userId: string, tier: TierName, action: UsageAction, amount: number): Promise<void> {
    const limits = getTierLimits(tier);
    const limitValue = limits[ACTION_TO_LIMIT_KEY[action]];

    if (limitValue === -1) return; // unlimited

    const date = todayKey();
    const key = redisKey(userId, date, action);

    let current = 0;
    try {
      const val = await redis.get(key);
      current = val ? parseInt(val, 10) : 0;
    } catch {
      // Redis down — fall back to DB
      current = await this.getDbUsage(userId, date, action);
    }

    if (current + amount > limitValue) {
      throw new UsageLimitError(
        `Daily ${ACTION_LABELS[action]} limit reached (${current}/${limitValue}). Upgrade your plan for higher limits.`
      );
    }
  }

  async recordUsage(userId: string, action: UsageAction, amount: number): Promise<void> {
    const date = todayKey();
    const key = redisKey(userId, date, action);

    try {
      const pipeline = redis.pipeline();
      pipeline.incrby(key, amount);
      pipeline.expire(key, 90_000); // 25 hours TTL
      await pipeline.exec();
    } catch (err) {
      logger.warn({ err }, 'Redis usage record failed, writing to DB only');
    }

    this.persistToDb(userId, date, action, amount).catch((err) =>
      logger.error({ err }, 'Failed to persist usage to DB')
    );
  }

  async getUsage(userId: string, tier: TierName) {
    const date = todayKey();
    const limits = getTierLimits(tier);

    let translate = 0;
    let transcribe = 0;
    let tts = 0;

    try {
      const [t, tr, s] = await Promise.all([
        redis.get(redisKey(userId, date, 'translate')),
        redis.get(redisKey(userId, date, 'transcribe')),
        redis.get(redisKey(userId, date, 'tts')),
      ]);
      translate = t ? parseInt(t, 10) : 0;
      transcribe = tr ? parseInt(tr, 10) : 0;
      tts = s ? parseInt(s, 10) : 0;
    } catch {
      const dbUsage = await this.getDbRecord(userId, date);
      if (dbUsage) {
        translate = dbUsage.charsTranslated;
        transcribe = dbUsage.transcriptionCount;
        tts = dbUsage.ttsCount;
      }
    }

    return {
      date,
      tier,
      usage: {
        translate: { used: translate, limit: limits.charsPerDay },
        transcribe: { used: transcribe, limit: limits.transcriptionsPerDay },
        tts: { used: tts, limit: limits.ttsPerDay },
      },
      features: {
        conversationsEnabled: limits.conversationsEnabled,
        audioTrimming: limits.audioTrimming,
        apiAccess: limits.apiAccess,
        exportEnabled: limits.exportEnabled,
      },
    };
  }

  private async getDbUsage(userId: string, date: string, action: UsageAction): Promise<number> {
    const record = await this.getDbRecord(userId, date);
    if (!record) return 0;
    const fieldMap = {
      translate: record.charsTranslated,
      transcribe: record.transcriptionCount,
      tts: record.ttsCount,
    } as const;
    return fieldMap[action] || 0;
  }

  private async getDbRecord(userId: string, date: string) {
    return prisma.usageRecord.findUnique({
      where: { userId_date: { userId, date: new Date(date) } },
    });
  }

  private async persistToDb(userId: string, date: string, action: UsageAction, amount: number): Promise<void> {
    const field = ACTION_TO_DB_FIELD[action];
    await prisma.usageRecord.upsert({
      where: { userId_date: { userId, date: new Date(date) } },
      create: {
        userId,
        date: new Date(date),
        [field]: amount,
      },
      update: {
        [field]: { increment: amount },
      },
    });
  }
}

export const usageService = new UsageService();
