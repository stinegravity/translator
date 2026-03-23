import prisma from '../infrastructure/db';
import crypto from 'crypto';

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

function generateApiKey(): { key: string; prefix: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('base64url');
  const key = `ka_${raw}`;
  const prefix = key.slice(0, 10);
  const hash = hashKey(key);
  return { key, prefix, hash };
}

export const apiKeyRepository = {
  async create(userId: string, name: string, expiresAt?: Date) {
    const { key, prefix, hash } = generateApiKey();
    const record = await prisma.apiKey.create({
      data: {
        userId,
        name,
        keyHash: hash,
        keyPrefix: prefix,
        expiresAt: expiresAt ?? null,
      },
      select: { id: true, name: true, keyPrefix: true, expiresAt: true, createdAt: true },
    });
    return { ...record, key }; // Return full key only at creation
  },

  async list(userId: string) {
    return prisma.apiKey.findMany({
      where: { userId, revokedAt: null },
      select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async revoke(id: string, userId: string) {
    return prisma.apiKey.updateMany({
      where: { id, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  async findByKey(apiKey: string) {
    const hash = hashKey(apiKey);
    const record = await prisma.apiKey.findUnique({
      where: { keyHash: hash },
      include: { user: { select: { id: true, email: true, name: true, tier: true, portalAccess: true, internalRole: true, reviewerAccess: true, reviewerAccessStatus: true } } },
    });

    if (!record) return null;
    if (record.revokedAt) return null;
    if (record.expiresAt && record.expiresAt < new Date()) return null;

    // Touch lastUsedAt (fire-and-forget)
    prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

    return record;
  },
};
