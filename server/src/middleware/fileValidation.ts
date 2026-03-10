import { Request, Response, NextFunction } from 'express';
import { logger } from '../infrastructure/logger';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export function validateAudioUpload(req: Request, res: Response, next: NextFunction) {
  if (!req.file) {
    return res.status(400).json({ error: 'Audio file is required' });
  }

  if (req.file.size > MAX_FILE_SIZE) {
    logger.warn({ size: req.file.size, limit: MAX_FILE_SIZE }, 'Audio file too large');
    return res.status(400).json({ error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024} MB limit` });
  }

  const mimetype = req.file.mimetype?.toLowerCase() ?? '';
  if (!mimetype.startsWith('audio/')) {
    logger.warn({ mimetype }, 'Invalid audio mime type');
    return res.status(400).json({
      error: 'Invalid file type. Audio files only (webm, mp3, wav, etc.)',
    });
  }

  next();
}
