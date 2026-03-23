import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StorageService } from '../server/src/services/storageService';
import fs from 'fs/promises';
import path from 'path';

describe('StorageService', () => {
  let service: StorageService;
  const savedFiles: string[] = [];

  beforeEach(() => {
    service = new StorageService();
  });

  afterEach(async () => {
    for (const f of savedFiles) {
      try { await fs.unlink(f); } catch { /* ignore */ }
    }
    savedFiles.length = 0;
  });

  describe('saveFile', () => {
    it('saves buffer to uploads directory with UUID name', async () => {
      const buffer = Buffer.from('test content');
      const result = await service.saveFile(buffer, 'test.txt');
      savedFiles.push(result.filePath);

      expect(result.fileName).toMatch(/\.txt$/);
      expect(result.sizeBytes).toBe(buffer.byteLength);
      const content = await fs.readFile(result.filePath, 'utf-8');
      expect(content).toBe('test content');
    });
  });

  describe('getFile', () => {
    it('retrieves a previously saved file', async () => {
      const buffer = Buffer.from('retrieve me');
      const { fileName, filePath } = await service.saveFile(buffer, 'data.bin');
      savedFiles.push(filePath);

      const retrieved = await service.getFile(fileName);
      expect(retrieved.toString('utf-8')).toBe('retrieve me');
    });
  });

  describe('path traversal protection', () => {
    it('rejects path traversal attempts', () => {
      expect(() => service.getFilePath('../../../etc/passwd')).toThrow('Invalid file path');
    });

    it('rejects absolute paths in fileName', () => {
      expect(() => service.getFilePath('/etc/passwd')).toThrow('Invalid file path');
    });
  });

  describe('saveExportFile', () => {
    it('saves export with sanitized name', async () => {
      const buffer = Buffer.from('export data');
      const result = await service.saveExportFile(buffer, 'My Export / Report.txt');
      savedFiles.push(result.filePath);

      expect(result.fileName).toMatch(/\.txt$/);
      expect(result.fileName).not.toContain('/');
      expect(result.sizeBytes).toBe(buffer.byteLength);
    });
  });

  describe('export path traversal protection', () => {
    it('rejects path traversal on export files', () => {
      expect(() => service.getExportFilePath('../../etc/passwd')).toThrow('Invalid file path');
    });
  });
});
