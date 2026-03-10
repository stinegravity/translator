import prisma from '../infrastructure/db';
import { Prisma } from '@prisma/client';

export type AnalyticsEventType =
  | 'translation'
  | 'transcription'
  | 'tts'
  | 'favorite_add'
  | 'favorite_remove'
  | 'history_archive';

export interface AnalyticsEventInput {
  eventType: AnalyticsEventType;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export class AnalyticsRepository {
  async track(event: AnalyticsEventInput) {
    return prisma.analyticsEvent.create({
      data: {
        ...event,
        metadata: event.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }
}

export const analyticsRepository = new AnalyticsRepository();
