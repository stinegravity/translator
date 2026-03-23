import Queue from 'bull';
import fs from 'fs/promises';
import { transcriptionService } from '../services/transcriptionService';
import { youTubeService } from '../services/youtubeService';
import { usageService } from '../services/usageService';
import { logger } from '../infrastructure/logger';
import redis from '../infrastructure/redis';
import type { TierName } from '../config/tiers';

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
/** Time in seconds to keep job results in Redis (1 hour) */
const RESULT_TTL = 3600;
/** Time in seconds to keep job ownership records (1 hour) */
const OWNER_TTL = 3600;
/** Max retry attempts for failed jobs */
const MAX_JOB_ATTEMPTS = 2;
/** Base delay for exponential backoff on retries (ms) */
const RETRY_BACKOFF_DELAY = 5000;

export interface TranscriptionJobData {
  type: 'audio';
  tempPath: string;
  originalName: string;
  mimetype: string;
  direction: string;
  diarize: boolean;
  userId: string;
  folderId?: string;
  dialect: string;
  conversationId?: string;
  tier: TierName;
}

export interface TranscriptionUrlJobData {
  type: 'url';
  url: string;
  direction: string;
  diarize: boolean;
  userId: string;
  folderId?: string;
  dialect: string;
  conversationId?: string;
  tier: TierName;
}

export type TranscriptionJobPayload = TranscriptionJobData | TranscriptionUrlJobData;

export interface TranscriptionResult {
  status: 'completed';
  transcribed: string;
  translated: string;
  source: string;
  target: string;
  historyId?: string;
  segments?: Array< { id: string; speaker: string; start: number; end: number; text: string; translatedText: string }>;
}

export interface TranscriptionError {
  status: 'failed';
  error: string;
}

const queueName = 'transcription';
export const transcriptionQueue = new Queue<TranscriptionJobPayload>(queueName, REDIS_URL, {
  defaultJobOptions: {
    removeOnComplete: { age: 3600, count: 500 },
    removeOnFail: { age: 86400 },
    attempts: MAX_JOB_ATTEMPTS,
    backoff: { type: 'exponential', delay: RETRY_BACKOFF_DELAY },
  },
});

async function storeResult(jobId: string, result: TranscriptionResult | TranscriptionError) {
  const key = `transcription:result:${jobId}`;
  await redis.set(key, JSON.stringify(result), 'EX', RESULT_TTL);
}

async function processAudioJob(data: TranscriptionJobData): Promise<TranscriptionResult | TranscriptionError> {
  const tempPath = data.tempPath;
  try {
    await fs.access(tempPath);
  } catch (e) {
    logger.warn({ err: e, tempPath }, 'Temp file missing before processing (may have been restarted)');
    return { status: 'failed', error: 'Upload expired — please try again' };
  }
  try {
    const buffer = await fs.readFile(tempPath);
    const result = await transcriptionService.transcribeAndTranslate(
      buffer,
      data.originalName,
      data.mimetype,
      data.direction,
      data.diarize,
      data.userId,
      data.folderId,
      data.dialect,
      data.conversationId,
      data.tier
    );
    await usageService.recordUsage(data.userId, 'transcribe', 1);
    return {
      status: 'completed',
      transcribed: result.transcribed,
      translated: result.translated,
      source: result.source,
      target: result.target,
      historyId: result.historyId,
      segments: result.segments,
    };
  } finally {
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore ENOENT — file may already be gone
    }
  }
}

async function processUrlJob(data: TranscriptionUrlJobData): Promise<TranscriptionResult | TranscriptionError> {
  try {
    const download = await youTubeService.downloadAudio(data.url);
    const result = await transcriptionService.transcribeAndTranslate(
      download.buffer,
      download.originalName,
      download.mimeType,
      data.direction,
      data.diarize,
      data.userId,
      data.folderId,
      data.dialect,
      data.conversationId,
      data.tier
    );
    await usageService.recordUsage(data.userId, 'transcribe', 1);
    return {
      status: 'completed',
      transcribed: result.transcribed,
      translated: result.translated,
      source: result.source,
      target: result.target,
      historyId: result.historyId,
      segments: result.segments,
    };
  } catch (err) {
    return {
      status: 'failed',
      error: err instanceof Error ? err.message : 'Transcription failed',
    };
  }
}

transcriptionQueue.process(async (job) => {
  const { id } = job;
  logger.info({ jobId: id, type: job.data.type }, 'Processing transcription job');
  try {
    let result: TranscriptionResult | TranscriptionError;
    if (job.data.type === 'audio') {
      result = await processAudioJob(job.data);
    } else if (job.data.type === 'url') {
      result = await processUrlJob(job.data);
    } else {
      result = { status: 'failed', error: 'Unknown job type' };
    }
    await storeResult(String(id), result);
    return result;
  } catch (err) {
    const errorResult: TranscriptionError = {
      status: 'failed',
      error: err instanceof Error ? err.message : 'Transcription failed',
    };
    await storeResult(String(id), errorResult);
    throw err;
  }
});

transcriptionQueue.on('error', (err) => logger.error({ err }, 'Transcription queue error'));
transcriptionQueue.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Transcription job failed'));

export async function setJobOwner(jobId: string, userId: string) {
  await redis.set(`transcription:owner:${jobId}`, userId, 'EX', OWNER_TTL);
}

export async function getJobOwner(jobId: string): Promise<string | null> {
  return redis.get(`transcription:owner:${jobId}`);
}

export async function getJobResult(jobId: string): Promise<TranscriptionResult | TranscriptionError | null> {
  const key = `transcription:result:${jobId}`;
  const raw = await redis.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as TranscriptionResult | TranscriptionError;
}
