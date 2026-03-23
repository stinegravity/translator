import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class StorageService {
  private readonly uploadDir: string;
  private readonly exportDir: string;

  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads');
    this.exportDir = path.join(process.cwd(), 'exports');
    this.ensureDirs();
  }

  private async ensureDir(dir: string) {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private async ensureDirs() {
    await Promise.all([this.ensureDir(this.uploadDir), this.ensureDir(this.exportDir)]);
  }

  async saveFile(buffer: Buffer, originalName: string): Promise<{
    fileName: string;
    filePath: string;
    sizeBytes: number;
  }> {
    const ext = path.extname(originalName);
    const fileName = `${uuidv4()}${ext}`;
    const filePath = path.join(this.uploadDir, fileName);
    await fs.writeFile(filePath, buffer);
    return {
      fileName,
      filePath,
      sizeBytes: buffer.byteLength,
    };
  }

  private assertSafePath(baseDir: string, fileName: string): string {
    const resolved = path.resolve(baseDir, fileName);
    if (!resolved.startsWith(baseDir + path.sep) && resolved !== baseDir) {
      throw new Error('Invalid file path');
    }
    return resolved;
  }

  async getFile(fileName: string): Promise<Buffer> {
    const filePath = this.assertSafePath(this.uploadDir, fileName);
    return await fs.readFile(filePath);
  }

  getFilePath(fileName: string): string {
    return this.assertSafePath(this.uploadDir, fileName);
  }

  async saveExportFile(buffer: Buffer, originalName: string): Promise<{
    fileName: string;
    filePath: string;
    sizeBytes: number;
  }> {
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    const safeBaseName = baseName.replace(/[^a-z0-9-_]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'export';
    const fileName = `${safeBaseName}_${uuidv4()}${ext}`;
    const filePath = path.join(this.exportDir, fileName);
    await fs.writeFile(filePath, buffer);
    return {
      fileName,
      filePath,
      sizeBytes: buffer.byteLength,
    };
  }

  async getExportFile(fileName: string): Promise<Buffer> {
    const filePath = this.assertSafePath(this.exportDir, fileName);
    return await fs.readFile(filePath);
  }

  getExportFilePath(fileName: string): string {
    return this.assertSafePath(this.exportDir, fileName);
  }
}

export const storageService = new StorageService();
