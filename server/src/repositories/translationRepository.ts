import prisma from '../infrastructure/db';
import { InputMode } from '../types';

interface SaveHistoryInput {
  userId?: string;
  folderId?: string;
  conversationId?: string;
  audioAssetId?: string;
  source: string;
  target: string;
  input: string;
  output: string;
  mode: InputMode;
  transcribed?: string;
  segments?: Array<{
    speaker: string;
    start: number;
    end: number;
    text: string;
    translatedText?: string;
  }>;
}

interface SaveAudioAssetInput {
  userId?: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  storagePath: string;
  sizeBytes?: number;
  durationSeconds?: number;
}

interface SaveUserSettingsInput {
  userId: string;
  preferredDirection?: string;
  preferredInputMode?: InputMode;
  diarizationEnabled?: boolean;
  preferredVoice?: string;
}

interface CreateConversationInput {
  title?: string;
  userId?: string;
  folderId?: string;
}

interface UpdateHistoryTranscriptInput {
  id: string;
  userEmail: string;
  transcript: string;
  translated: string;
}

interface CreateExportJobInput {
  userId: string;
  historyId?: string;
  conversationId?: string;
  format: string;
  fileName: string;
  mimeType: string;
  storagePath: string;
  sizeBytes: number;
}

export class TranslationRepository {
  async ensureUser(email: string, name?: string) {
    return prisma.user.upsert({
      where: { email },
      update: name ? { name } : {},
      create: { email, name },
    });
  }

  async saveAudioAsset(data: SaveAudioAssetInput) {
    return prisma.audioAsset.create({
      data,
    });
  }

  async saveHistory(data: SaveHistoryInput) {
    const { segments, ...historyData } = data;

    return prisma.translationHistory.create({
      data: {
        ...historyData,
        ...(segments && segments.length > 0
          ? {
              segments: {
                create: segments.map((segment, index) => ({
                  segmentIndex: index,
                  ...segment,
                })),
              },
            }
          : {}),
      },
      include: {
        segments: {
          orderBy: { segmentIndex: 'asc' },
        },
        audioAsset: true,
        favorites: true,
        folder: true,
        conversation: true,
      },
    });
  }

  async getRecentHistory(limit: number = 10, userEmail?: string) {
    let userId: string | undefined;
    if (userEmail) {
      const u = await prisma.user.findUnique({ where: { email: userEmail } });
      userId = u?.id;
    }

    return prisma.translationHistory.findMany({
      where: {
        archivedAt: null,
        ...(userEmail ? { userId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        segments: {
          orderBy: { segmentIndex: 'asc' },
        },
        audioAsset: true,
        favorites: true,
        folder: true,
        conversation: true,
      },
    });
  }

  async getHistoryById(id: string, userEmail?: string) {
    return prisma.translationHistory.findFirst({
      where: {
        id,
        archivedAt: null,
        ...(userEmail ? { user: { email: userEmail } } : {}),
      },
      include: {
        segments: {
          orderBy: { segmentIndex: 'asc' },
        },
        audioAsset: true,
        favorites: true,
        folder: true,
        conversation: true,
      },
    });
  }

  async createConversation(data: CreateConversationInput) {
    return prisma.conversation.create({
      data: {
        title: data.title?.trim() || 'New conversation',
        userId: data.userId,
        folderId: data.folderId,
      },
      include: {
        folder: true,
      },
    });
  }

  async listConversations(userEmail?: string, folderId?: string, limit = 50, offset = 0) {
    return prisma.conversation.findMany({
      where: {
        ...(userEmail ? { user: { email: userEmail } } : {}),
        ...(folderId ? { folderId } : {}),
      },
      orderBy: [
        { lastActivityAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: Math.min(limit, 200),
      skip: offset,
      include: {
        folder: true,
        _count: {
          select: {
            histories: {
              where: { archivedAt: null },
            },
          },
        },
      },
    });
  }

  async getConversation(id: string, userEmail?: string, historyLimit = 100, historyOffset = 0) {
    return prisma.conversation.findFirst({
      where: {
        id,
        ...(userEmail ? { user: { email: userEmail } } : {}),
      },
      include: {
        folder: true,
        histories: {
          where: {
            archivedAt: null,
          },
          orderBy: { createdAt: 'asc' },
          take: Math.min(historyLimit, 200),
          skip: historyOffset,
          include: {
            segments: {
              orderBy: { segmentIndex: 'asc' },
            },
            audioAsset: true,
            favorites: true,
            folder: true,
          },
        },
      },
    });
  }

  async getConversationForExport(id: string, userEmail?: string) {
    return prisma.conversation.findFirst({
      where: {
        id,
        ...(userEmail ? { user: { email: userEmail } } : {}),
      },
      include: {
        histories: {
          where: {
            archivedAt: null,
          },
          orderBy: { createdAt: 'asc' },
          include: {
            segments: {
              orderBy: { segmentIndex: 'asc' },
            },
          },
        },
      },
    });
  }

  async updateConversation(id: string, updates: { title?: string; folderId?: string | null }, userEmail?: string) {
    const existing = await prisma.conversation.findFirst({
      where: {
        id,
        ...(userEmail ? { user: { email: userEmail } } : {}),
      },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    return prisma.conversation.update({
      where: { id },
      data: {
        ...(updates.title !== undefined ? { title: updates.title.trim() || 'New conversation' } : {}),
        ...(updates.folderId !== undefined ? { folderId: updates.folderId } : {}),
      },
      include: {
        folder: true,
        _count: {
          select: {
            histories: {
              where: { archivedAt: null },
            },
          },
        },
      },
    });
  }

  async deleteConversation(id: string, userEmail?: string) {
    const existing = await prisma.conversation.findFirst({
      where: {
        id,
        ...(userEmail ? { user: { email: userEmail } } : {}),
      },
      select: { id: true },
    });

    if (!existing) {
      return false;
    }

    await prisma.$transaction([
      prisma.translationHistory.updateMany({
        where: { conversationId: id },
        data: { conversationId: null },
      }),
      prisma.conversation.delete({
        where: { id },
      }),
    ]);

    return true;
  }

  async touchConversation(id: string) {
    return prisma.conversation.update({
      where: { id },
      data: {
        lastActivityAt: new Date(),
      },
    });
  }

  async listFavorites(userEmail: string, limit = 50, offset = 0) {
    return prisma.favorite.findMany({
      where: {
        user: { email: userEmail },
        history: {
          archivedAt: null,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      skip: offset,
      include: {
        history: {
          include: {
            segments: {
              orderBy: { segmentIndex: 'asc' },
            },
            audioAsset: true,
            folder: true,
          },
        },
      },
    });
  }

  async addFavorite(userId: string, historyId: string) {
    return prisma.favorite.upsert({
      where: {
        userId_historyId: {
          userId,
          historyId,
        },
      },
      update: {},
      create: {
        userId,
        historyId,
      },
    });
  }

  async removeFavorite(userId: string, historyId: string) {
    return prisma.favorite.deleteMany({
      where: {
        userId,
        historyId,
      },
    });
  }

  async archiveHistory(id: string, userEmail?: string) {
    const existing = await prisma.translationHistory.findFirst({
      where: {
        id,
        archivedAt: null,
        ...(userEmail ? { user: { email: userEmail } } : {}),
      },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    return prisma.translationHistory.update({
      where: { id },
      data: {
        archivedAt: new Date(),
      },
    });
  }

  async updateHistoryTranscript(data: UpdateHistoryTranscriptInput) {
    const existing = await prisma.translationHistory.findFirst({
      where: {
        id: data.id,
        archivedAt: null,
        user: { email: data.userEmail },
      },
      include: {
        conversation: true,
      },
    });

    if (!existing || existing.mode !== 'audio') {
      return null;
    }

    await prisma.transcriptionSegment.deleteMany({
      where: { historyId: data.id },
    });

    return prisma.translationHistory.update({
      where: { id: data.id },
      data: {
        input: data.transcript,
        transcribed: data.transcript,
        output: data.translated,
      },
      include: {
        segments: {
          orderBy: { segmentIndex: 'asc' },
        },
        audioAsset: true,
        favorites: true,
        folder: true,
        conversation: true,
      },
    });
  }

  async getUserSettings(userEmail: string) {
    return prisma.userSettings.findFirst({
      where: { user: { email: userEmail } },
    });
  }

  async saveUserSettings(data: SaveUserSettingsInput) {
    return prisma.userSettings.upsert({
      where: { userId: data.userId },
      update: {
        ...(data.preferredDirection !== undefined && { preferredDirection: data.preferredDirection }),
        ...(data.preferredInputMode !== undefined && { preferredInputMode: data.preferredInputMode }),
        ...(data.diarizationEnabled !== undefined && { diarizationEnabled: data.diarizationEnabled }),
        ...(data.preferredVoice !== undefined && { preferredVoice: data.preferredVoice }),
      },
      create: {
        userId: data.userId,
        preferredDirection: data.preferredDirection,
        preferredInputMode: data.preferredInputMode,
        diarizationEnabled: data.diarizationEnabled ?? false,
        preferredVoice: data.preferredVoice,
      },
    });
  }

  async createExportJob(data: CreateExportJobInput) {
    return prisma.exportJob.create({
      data: {
        ...data,
        completedAt: new Date(),
      },
    });
  }

  async listExportJobs(userId: string) {
    return prisma.exportJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        history: {
          select: {
            id: true,
            mode: true,
            createdAt: true,
          },
        },
        conversation: {
          select: {
            id: true,
            title: true,
            createdAt: true,
          },
        },
      },
    });
  }

  async getExportJob(id: string, userId: string) {
    return prisma.exportJob.findFirst({
      where: {
        id,
        userId,
      },
    });
  }
}

export const translationRepository = new TranslationRepository();
