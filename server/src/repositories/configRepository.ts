import prisma from '../infrastructure/db';

const MODEL_KEYS = [
  'OPENAI_TRANSLATION_MODEL',
  'OPENAI_TRANSCRIPTION_MODEL',
  'OPENAI_TRANSCRIPTION_DIARIZE_MODEL',
  'OPENAI_TTS_MODEL',
] as const;

export type ModelConfigKey = (typeof MODEL_KEYS)[number];

export const DEFAULT_MODELS: Record<ModelConfigKey, string> = {
  OPENAI_TRANSLATION_MODEL: 'gpt-4o',
  OPENAI_TRANSCRIPTION_MODEL: 'whisper-1',
  OPENAI_TRANSCRIPTION_DIARIZE_MODEL: 'gpt-4o-transcribe-diarize',
  OPENAI_TTS_MODEL: 'tts-1',
};

export async function getModelConfig(): Promise<Record<ModelConfigKey, string>> {
  const rows = await prisma.systemConfig.findMany({
    where: { key: { in: [...MODEL_KEYS] } },
    select: { key: true, value: true },
  });

  const map = new Map(rows.map((r) => [r.key as ModelConfigKey, r.value]));
  const result: Record<string, string> = {};
  for (const key of MODEL_KEYS) {
    result[key] = map.get(key) ?? process.env[key] ?? DEFAULT_MODELS[key];
  }
  return result as Record<ModelConfigKey, string>;
}

export async function setModelConfig(key: ModelConfigKey, value: string): Promise<void> {
  await prisma.systemConfig.upsert({
    where: { key },
    update: { value: value.trim(), updatedAt: new Date() },
    create: { key, value: value.trim(), updatedAt: new Date() },
  });
}

export async function setModelConfigBatch(updates: Partial<Record<ModelConfigKey, string>>): Promise<void> {
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined && MODEL_KEYS.includes(key as ModelConfigKey)) {
      await setModelConfig(key as ModelConfigKey, value);
    }
  }
}
