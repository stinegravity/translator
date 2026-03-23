import * as configRepository from '../repositories/configRepository';
import type { ModelConfigKey } from '../repositories/configRepository';

let cache: Record<ModelConfigKey, string> | null = null;

export async function getModels(): Promise<Record<ModelConfigKey, string>> {
  if (cache) return cache;
  cache = await configRepository.getModelConfig();
  return cache;
}

export function invalidateCache(): void {
  cache = null;
}

export async function updateModels(updates: Partial<Record<ModelConfigKey, string>>): Promise<Record<ModelConfigKey, string>> {
  await configRepository.setModelConfigBatch(updates);
  invalidateCache();
  return getModels();
}

export const modelConfigService = {
  getModels,
  invalidateCache,
  updateModels,
};
