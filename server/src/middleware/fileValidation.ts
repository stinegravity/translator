import { Request, Response, NextFunction } from 'express';
import { logger } from '../infrastructure/logger';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

// Magic byte signatures for common audio formats
const AUDIO_SIGNATURES: Array<{ prefix: number[]; offset?: number }> = [
  { prefix: [0x52, 0x49, 0x46, 0x46] },            // RIFF (WAV)
  { prefix: [0x49, 0x44, 0x33] },                   // ID3 (MP3)
  { prefix: [0xFF, 0xFB] },                          // MP3 frame sync
  { prefix: [0xFF, 0xF3] },                          // MP3 frame sync
  { prefix: [0xFF, 0xF2] },                          // MP3 frame sync
  { prefix: [0x4F, 0x67, 0x67, 0x53] },             // OGG
  { prefix: [0x66, 0x4C, 0x61, 0x43] },             // FLAC
  { prefix: [0x1A, 0x45, 0xDF, 0xA3] },             // WebM/Matroska
  { prefix: [0x00, 0x00, 0x00], offset: 0 },        // MP4/M4A (ftyp box — checked with extension)
];

function hasValidAudioSignature(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;

  for (const sig of AUDIO_SIGNATURES) {
    const offset = sig.offset ?? 0;
    const match = sig.prefix.every((byte, i) => buffer[offset + i] === byte);
    if (match) return true;
  }

  // MP4/M4A: check for 'ftyp' at byte 4
  if (buffer.length >= 8 && buffer.toString('ascii', 4, 8) === 'ftyp') return true;

  return false;
}

export function validateAudioUpload(req: Request, res: Response, next: NextFunction) {
  if (!req.file) {
    return res.status(400).json({ error: 'Audio file is required' });
  }

  if (req.file.size > MAX_FILE_SIZE) {
    logger.warn({ size: req.file.size, limit: MAX_FILE_SIZE }, 'Audio file too large');
    return res.status(400).json({ error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024} MB limit` });
  }

  const mimetype = req.file.mimetype?.toLowerCase() ?? '';
  if (!mimetype.startsWith('audio/') && !mimetype.startsWith('video/webm')) {
    logger.warn({ mimetype }, 'Invalid audio mime type');
    return res.status(400).json({
      error: 'Invalid file type. Audio files only (webm, mp3, wav, etc.)',
    });
  }

  if (!hasValidAudioSignature(req.file.buffer)) {
    logger.warn({ mimetype, size: req.file.size }, 'Audio file failed magic byte validation');
    return res.status(400).json({
      error: 'File content does not match an audio format',
    });
  }

  next();
}
