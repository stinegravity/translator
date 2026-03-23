import { Request, Response } from 'express';
import { modelConfigService } from '../services/modelConfigService';
import { logger } from '../infrastructure/logger';
import { DEFAULT_MODELS, type ModelConfigKey } from '../repositories/configRepository';

const DISPLAY_KEYS: Record<ModelConfigKey, string> = {
  OPENAI_TRANSLATION_MODEL: 'Translation (GPT)',
  OPENAI_TRANSCRIPTION_MODEL: 'Transcription (Whisper)',
  OPENAI_TRANSCRIPTION_DIARIZE_MODEL: 'Transcription with diarization',
  OPENAI_TTS_MODEL: 'Text-to-speech',
};

export const modelConfigController = {
  get: async (_req: Request, res: Response) => {
    try {
      const models = await modelConfigService.getModels();
      const items = Object.entries(DISPLAY_KEYS).map(([key, label]) => ({
        key,
        label,
        value: models[key as ModelConfigKey],
        default: DEFAULT_MODELS[key as ModelConfigKey],
      }));
      res.json({ items });
    } catch (err) {
      logger.error({ err }, 'Get model config error');
      res.status(500).json({ error: 'Failed to load model config' });
    }
  },

  update: async (req: Request, res: Response) => {
    try {
      const updates = req.body as Record<string, string>;
      const validKeys: ModelConfigKey[] = [
        'OPENAI_TRANSLATION_MODEL',
        'OPENAI_TRANSCRIPTION_MODEL',
        'OPENAI_TRANSCRIPTION_DIARIZE_MODEL',
        'OPENAI_TTS_MODEL',
      ];
      const filtered: Partial<Record<ModelConfigKey, string>> = {};
      for (const key of validKeys) {
        if (typeof updates[key] === 'string' && updates[key].trim()) {
          filtered[key] = updates[key].trim();
        }
      }
      const models = await modelConfigService.updateModels(filtered);
      res.json({ models });
    } catch (err) {
      logger.error({ err }, 'Update model config error');
      res.status(500).json({ error: 'Failed to update model config' });
    }
  },
};
