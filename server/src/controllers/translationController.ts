import fs from 'fs/promises';
import path from 'path';
import { Request, Response } from 'express';
import { speakerService } from '../services/speakerService';
import { translationService } from '../services/translationService';
import { exportService } from '../services/exportService';
import { storageService } from '../services/storageService';
import { usageService } from '../services/usageService';
import { translationRepository } from '../repositories/translationRepository';
import { analyticsRepository } from '../repositories/analyticsRepository';
import { logger } from '../infrastructure/logger';
import prisma from '../infrastructure/db';
import redis from '../infrastructure/redis';
import { transcriptionQueue, getJobResult, getJobOwner, setJobOwner } from '../queues/transcriptionQueue';
import { v4 as uuidv4 } from 'uuid';
import { Direction, InputMode } from '../types';
import type { HistoryItemForExport } from '../types/export';
import type { AuthenticatedRequest } from '../middleware/auth';

export class TranslationController {
  private getUser(req: Request) {
    return (req as AuthenticatedRequest).user;
  }

  private async resolveUserId(req: Request) {
    return this.getUser(req).id;
  }

  private parseDirection(direction: string = 'en-tw'): [string, string] {
    if (direction.includes('-')) {
      const parts = direction.split('-');
      if (parts.length === 2 && parts[0] && parts[1]) {
        return [parts[0], parts[1]];
      }
    }
    return ['en', 'tw'];
  }

  translate = async (req: Request, res: Response) => {
    try {
      const { text, direction, context, folderId, dialect, conversationId } = req.body as { text: string; direction?: string; context?: string; folderId?: string; dialect?: string; conversationId?: string };
      const [source, target] = this.parseDirection(direction);
      const user = this.getUser(req);

      await usageService.checkLimit(user.id, user.tier, 'translate', text.length);

      const translation = await translationService.translate(text, target, source, context ?? 'Casual', user.id, folderId, dialect, conversationId, user.tier);

      await usageService.recordUsage(user.id, 'translate', text.length);

      res.json({ translated: translation.translated, source, target, historyId: translation.historyId });
    } catch (err: unknown) {
      if (err instanceof Error && 'statusCode' in err && (err as { statusCode: number }).statusCode === 429) {
        res.status(429).json({ error: err.message });
        return;
      }
      logger.error({ err }, 'Translate error');
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Translation failed',
      });
    }
  };

  transcribe = async (req: Request, res: Response) => {
    try {
      const direction = (req.body.direction as Direction) || 'tw-en';
      const diarize = req.body.diarize === true || req.body.diarize === 'true';
      const folderId = req.body.folderId as string | undefined;
      const dialect = (req.body.dialect as string) || 'Asante Twi';
      const conversationId = req.body.conversationId as string | undefined;
      const user = this.getUser(req);
      if (!req.file) {
        return res.status(400).json({ error: 'Audio file is required' });
      }

      await usageService.checkLimit(user.id, user.tier, 'transcribe', 1);

      const uploadDir = path.join(process.cwd(), 'uploads');
      await fs.mkdir(uploadDir, { recursive: true });
      const tempName = `temp-${uuidv4()}${path.extname(req.file.originalname || '') || '.webm'}`;
      const tempPath = path.join(uploadDir, tempName);
      await fs.writeFile(tempPath, req.file.buffer);

      const job = await transcriptionQueue.add(
        {
          type: 'audio',
          tempPath,
          originalName: req.file.originalname || 'audio.webm',
          mimetype: req.file.mimetype,
          direction,
          diarize,
          userId: user.id,
          folderId,
          dialect,
          conversationId,
          tier: user.tier,
        },
        { priority: 1 }
      );
      await setJobOwner(String(job.id), user.id);

      res.status(202).json({ jobId: String(job.id), status: 'processing' });
    } catch (err: unknown) {
      if (err instanceof Error && 'statusCode' in err && (err as { statusCode: number }).statusCode === 429) {
        res.status(429).json({ error: err.message });
        return;
      }
      logger.error({ err }, 'Transcribe error');
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Transcription failed',
      });
    }
  };

  getTranscriptionStatus = async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params as { jobId: string };
      const user = this.getUser(req);
      const owner = await getJobOwner(jobId);
      if (!owner || owner !== user.id) {
        return res.status(404).json({ error: 'Job not found' });
      }
      const result = await getJobResult(jobId);
      if (!result) {
        return res.json({ jobId, status: 'processing' });
      }
      if (result.status === 'failed') {
        return res.status(500).json({ jobId, ...result });
      }
      res.json({ jobId, ...result });
    } catch (err) {
      logger.error({ err }, 'Get transcription status error');
      res.status(500).json({ error: err instanceof Error ? err.message : 'Request failed' });
    }
  };

  transcribeUrl = async (req: Request, res: Response) => {
    try {
      const { url, direction, diarize, folderId, dialect, conversationId } = req.body as {
        url: string;
        direction?: Direction;
        diarize?: boolean;
        folderId?: string;
        dialect?: string;
        conversationId?: string;
      };
      const resolvedDirection = direction || 'tw-en';
      const user = this.getUser(req);

      await usageService.checkLimit(user.id, user.tier, 'transcribe', 1);

      const job = await transcriptionQueue.add(
        {
          type: 'url',
          url,
          direction: resolvedDirection,
          diarize: diarize === true,
          userId: user.id,
          folderId,
          dialect: dialect || 'Asante Twi',
          conversationId,
          tier: user.tier,
        },
        { priority: 2 }
      );
      await setJobOwner(String(job.id), user.id);

      res.status(202).json({ jobId: String(job.id), status: 'processing' });
    } catch (err) {
      if (err instanceof Error && 'statusCode' in err && (err as { statusCode: number }).statusCode === 429) {
        res.status(429).json({ error: err.message });
        return;
      }
      logger.error({ err }, 'Transcribe URL error');
      res.status(500).json({
        error: err instanceof Error ? err.message : 'YouTube transcription failed',
      });
    }
  };

  createHistoryExport = async (req: Request, res: Response) => {
    try {
      const user = this.getUser(req);
      const { historyId } = req.params as { historyId: string };
      const { format } = req.body as { format: 'txt' | 'srt' | 'vtt' };
      const history = await translationRepository.getHistoryById(historyId, user.email);

      if (!history) {
        return res.status(404).json({ error: 'History item not found' });
      }

      const built = exportService.buildHistoryExport(history as HistoryItemForExport, format);
      const stored = await storageService.saveExportFile(built.content, built.fileName);
      const exportJob = await translationRepository.createExportJob({
        userId: user.id,
        historyId: history.id,
        format,
        fileName: stored.fileName,
        mimeType: built.mimeType,
        storagePath: stored.filePath,
        sizeBytes: stored.sizeBytes,
      });

      res.status(201).json({ export: exportJob });
    } catch (err) {
      logger.error({ err }, 'Create history export error');
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create export' });
    }
  };

  createConversationExport = async (req: Request, res: Response) => {
    try {
      const user = this.getUser(req);
      const { id } = req.params as { id: string };
      const conversation = await translationRepository.getConversationForExport(id, user.email);

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      const built = exportService.buildConversationExport(conversation);
      const stored = await storageService.saveExportFile(built.content, built.fileName);
      const exportJob = await translationRepository.createExportJob({
        userId: user.id,
        conversationId: conversation.id,
        format: 'txt',
        fileName: stored.fileName,
        mimeType: built.mimeType,
        storagePath: stored.filePath,
        sizeBytes: stored.sizeBytes,
      });

      res.status(201).json({ export: exportJob });
    } catch (err) {
      logger.error({ err }, 'Create conversation export error');
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create export' });
    }
  };

  listExports = async (req: Request, res: Response) => {
    try {
      const user = this.getUser(req);
      const items = await translationRepository.listExportJobs(user.id);
      res.json({ items });
    } catch (err) {
      logger.error({ err }, 'List exports error');
      res.status(500).json({ error: 'Failed to load exports' });
    }
  };

  downloadExport = async (req: Request, res: Response) => {
    try {
      const user = this.getUser(req);
      const { id } = req.params as { id: string };
      const exportJob = await translationRepository.getExportJob(id, user.id);

      if (!exportJob) {
        return res.status(404).json({ error: 'Export not found' });
      }

      const buffer = await storageService.getExportFile(exportJob.fileName);
      res.set({
        'Content-Type': exportJob.mimeType,
        'Content-Length': buffer.length.toString(),
        'Content-Disposition': `attachment; filename="${exportJob.fileName}"`,
      });
      res.send(buffer);
    } catch (err) {
      logger.error({ err }, 'Download export error');
      res.status(500).json({ error: 'Failed to download export' });
    }
  };

  speak = async (req: Request, res: Response) => {
    try {
      const { text } = req.body as { text: string };
      const user = this.getUser(req);

      await usageService.checkLimit(user.id, user.tier, 'tts', 1);

      const buffer = await speakerService.textToSpeech(text, user.id);

      await usageService.recordUsage(user.id, 'tts', 1);

      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length,
      });
      res.send(buffer);
    } catch (err: unknown) {
      if (err instanceof Error && 'statusCode' in err && (err as { statusCode: number }).statusCode === 429) {
        res.status(429).json({ error: err.message });
        return;
      }
      logger.error({ err }, 'TTS error');
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Voice synthesis failed',
      });
    }
  };

  history = async (req: Request, res: Response) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 10, 50);
      const user = this.getUser(req);
      const items = await translationRepository.getRecentHistory(limit, user.email);
      res.json({ items });
    } catch (err) {
      logger.error(err, 'History error details');
      res.status(500).json({ error: 'Failed to load history' });
    }
  };

  archiveHistory = async (req: Request, res: Response) => {
    try {
      const user = this.getUser(req);
      const { historyId } = req.params as { historyId: string };
      const item = await translationRepository.archiveHistory(historyId, user.email);

      if (!item) {
        return res.status(404).json({ error: 'History item not found' });
      }

      analyticsRepository.track({ eventType: 'history_archive', userId: user.id, metadata: { historyId } }).catch((e) => logger.warn({ err: e }, 'Analytics track failed'));
      res.status(204).send();
    } catch (err) {
      logger.error({ err }, 'Archive history error');
      res.status(500).json({ error: 'Failed to archive history item' });
    }
  };

  updateHistoryTranscript = async (req: Request, res: Response) => {
    try {
      const user = this.getUser(req);
      const { historyId } = req.params as { historyId: string };
      const { transcript, context, dialect } = req.body as { transcript: string; context?: string; dialect?: string };

      const existing = await translationRepository.getHistoryById(historyId, user.email);
      if (!existing || existing.mode !== 'audio') {
        return res.status(404).json({ error: 'Audio history item not found' });
      }

      await usageService.checkLimit(user.id, user.tier, 'translate', transcript.length);
      const translated = await translationService.translateText(
        transcript,
        existing.target,
        existing.source,
        context ?? 'Casual',
        dialect ?? 'Asante Twi',
        user.tier
      );
      const updated = await translationRepository.updateHistoryTranscript({
        id: historyId,
        userEmail: user.email,
        transcript,
        translated,
      });

      if (!updated) {
        return res.status(404).json({ error: 'Audio history item not found' });
      }

      await usageService.recordUsage(user.id, 'translate', transcript.length);

      if (updated.conversation?.id) {
        translationRepository.touchConversation(updated.conversation.id).catch((e) => logger.warn({ err: e }, 'Conversation touch failed'));
      }
      res.json({ item: updated });
    } catch (err: unknown) {
      if (err instanceof Error && 'statusCode' in err && (err as { statusCode: number }).statusCode === 429) {
        res.status(429).json({ error: err.message });
        return;
      }
      logger.error({ err }, 'Update history transcript error');
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update transcript' });
    }
  };

  favorites = async (req: Request, res: Response) => {
    try {
      const user = this.getUser(req);
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
      const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);
      const items = await translationRepository.listFavorites(user.email, limit, offset);
      res.json({ items });
    } catch (err) {
      logger.error({ err }, 'Favorites error');
      res.status(500).json({ error: 'Failed to load favorites' });
    }
  };

  addFavorite = async (req: Request, res: Response) => {
    try {
      const { historyId } = req.body as { historyId: string };
      const user = this.getUser(req);
      const favorite = await translationRepository.addFavorite(user.id, historyId);
      analyticsRepository.track({ eventType: 'favorite_add', userId: user.id, metadata: { historyId } }).catch((e) => logger.warn({ err: e }, 'Analytics track failed'));
      res.status(201).json({ favorite });
    } catch (err) {
      logger.error({ err }, 'Add favorite error');
      res.status(500).json({ error: 'Failed to save favorite' });
    }
  };

  removeFavorite = async (req: Request, res: Response) => {
    try {
      const user = this.getUser(req);
      const { historyId } = req.params as { historyId: string };
      await translationRepository.removeFavorite(user.id, historyId);
      analyticsRepository.track({ eventType: 'favorite_remove', userId: user.id, metadata: { historyId } }).catch((e) => logger.warn({ err: e }, 'Analytics track failed'));
      res.status(204).send();
    } catch (err) {
      logger.error({ err }, 'Remove favorite error');
      res.status(500).json({ error: 'Failed to remove favorite' });
    }
  };

  getSettings = async (req: Request, res: Response) => {
    try {
      const user = this.getUser(req);
      const settings = await translationRepository.getUserSettings(user.email);
      res.json({ settings });
    } catch (err) {
      logger.error({ err }, 'Settings error');
      res.status(500).json({ error: 'Failed to load settings' });
    }
  };

  saveSettings = async (req: Request, res: Response) => {
    try {
      const user = this.getUser(req);
      const {
        preferredDirection,
        preferredInputMode,
        diarizationEnabled,
        preferredVoice,
      } = req.body as {
        preferredDirection?: string;
        preferredInputMode?: InputMode;
        diarizationEnabled?: boolean;
        preferredVoice?: string;
      };

      const settings = await translationRepository.saveUserSettings({
        userId: user.id,
        preferredDirection,
        preferredInputMode,
        diarizationEnabled,
        preferredVoice,
      });

      res.json({ settings });
    } catch (err) {
      logger.error({ err }, 'Save settings error');
      res.status(500).json({ error: 'Failed to save settings' });
    }
  };

  listConversations = async (req: Request, res: Response) => {
    try {
      const user = this.getUser(req);
      const folderId = typeof req.query.folderId === 'string' ? req.query.folderId : undefined;
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
      const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);
      const items = await translationRepository.listConversations(user.email, folderId, limit, offset);
      res.json({ items });
    } catch (err) {
      logger.error({ err }, 'List conversations error');
      res.status(500).json({ error: 'Failed to load conversations' });
    }
  };

  createConversation = async (req: Request, res: Response) => {
    try {
      const user = this.getUser(req);
      const { title, folderId } = req.body as { title?: string; folderId?: string };
      const conversation = await translationRepository.createConversation({
        title,
        folderId,
        userId: user.id,
      });
      res.status(201).json({ conversation });
    } catch (err) {
      logger.error({ err }, 'Create conversation error');
      res.status(500).json({ error: 'Failed to create conversation' });
    }
  };

  getConversation = async (req: Request, res: Response) => {
    try {
      const user = this.getUser(req);
      const { id } = req.params as { id: string };
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 200);
      const offset = Math.max(0, parseInt(req.query.offset as string, 10) || 0);
      const conversation = await translationRepository.getConversation(id, user.email, limit, offset);

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      res.json({ conversation });
    } catch (err) {
      logger.error({ err }, 'Get conversation error');
      res.status(500).json({ error: 'Failed to load conversation' });
    }
  };

  updateConversation = async (req: Request, res: Response) => {
    try {
      const user = this.getUser(req);
      const { id } = req.params as { id: string };
      const { title, folderId } = req.body as { title?: string; folderId?: string | null };
      const conversation = await translationRepository.updateConversation(id, { title, folderId }, user.email);

      if (!conversation) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      res.json({ conversation });
    } catch (err) {
      logger.error({ err }, 'Update conversation error');
      res.status(500).json({ error: 'Failed to update conversation' });
    }
  };

  deleteConversation = async (req: Request, res: Response) => {
    try {
      const user = this.getUser(req);
      const { id } = req.params as { id: string };
      const deleted = await translationRepository.deleteConversation(id, user.email);

      if (!deleted) {
        return res.status(404).json({ error: 'Conversation not found' });
      }

      res.status(204).send();
    } catch (err) {
      logger.error({ err }, 'Delete conversation error');
      res.status(500).json({ error: 'Failed to delete conversation' });
    }
  };

  getUsage = async (req: Request, res: Response) => {
    try {
      const user = this.getUser(req);
      const usage = await usageService.getUsage(user.id, user.tier);
      res.json(usage);
    } catch (err) {
      logger.error({ err }, 'Usage error');
      res.status(500).json({ error: 'Failed to load usage data' });
    }
  };

  getMe = async (req: Request, res: Response) => {
    try {
      const user = this.getUser(req);
      const usage = await usageService.getUsage(user.id, user.tier);
      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          tier: user.tier,
          portalAccess: user.portalAccess,
          internalRole: user.internalRole,
          reviewerAccess: user.reviewerAccess,
          reviewerAccessStatus: user.reviewerAccessStatus,
        },
        usage,
      });
    } catch (err) {
      logger.error({ err }, 'Get me error');
      res.status(500).json({ error: 'Failed to load account info' });
    }
  };

  health = async (_req: Request, res: Response) => {
    const checks: Record<string, string> = {};
    let ok = true;

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = 'ok';
    } catch {
      checks.database = 'error';
      ok = false;
    }

    try {
      await redis.ping();
      checks.redis = 'ok';
    } catch {
      checks.redis = 'error';
      ok = false;
    }

    checks.translation = process.env.OPENAI_API_KEY || process.env.GOOGLE_TRANSLATE_API_KEY ? 'ready' : 'missing key';
    checks.transcription = process.env.OPENAI_API_KEY ? 'ready' : 'missing key';

    res.status(ok ? 200 : 503).json({
      ok,
      timestamp: new Date().toISOString(),
      checks,
    });
  };
}

export const translationController = new TranslationController();
