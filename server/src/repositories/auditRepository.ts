import prisma from '../infrastructure/db';
import { Prisma } from '@prisma/client';

export interface AuditEntry {
  action: string;
  userId?: string;
  userEmail?: string;
  resourceId?: string;
  ip?: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export class AuditRepository {
  async log(entry: AuditEntry) {
    return prisma.auditLog.create({
      data: {
        ...entry,
        metadata: entry.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }
}

export const auditRepository = new AuditRepository();
