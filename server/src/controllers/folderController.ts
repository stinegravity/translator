import { Request, Response } from 'express';
import { folderRepository } from '../repositories/folderRepository';
import { logger } from '../infrastructure/logger';
import type { AuthenticatedRequest } from '../middleware/auth';

export class FolderController {
  private getUser(req: Request) {
    return (req as AuthenticatedRequest).user;
  }

  list = async (req: Request, res: Response) => {
    try {
      const user = this.getUser(req);
      const folders = await folderRepository.listFolders(user.id);
      res.json({ folders });
    } catch (err) {
      logger.error({ err }, 'List folders error');
      res.status(500).json({ error: 'Failed to load folders' });
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const { name } = req.body as { name: string };
      if (!name) return res.status(400).json({ error: 'Name is required' });

      const user = this.getUser(req);
      const folder = await folderRepository.createFolder(name, user.id);
      res.status(201).json({ folder });
    } catch (err) {
      logger.error({ err }, 'Create folder error');
      res.status(500).json({ error: 'Failed to create folder' });
    }
  };

  delete = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = this.getUser(req);
      await folderRepository.deleteFolder(id as string, user.id);
      res.status(204).send();
    } catch (err) {
      logger.error({ err }, 'Delete folder error');
      res.status(500).json({ error: 'Failed to delete folder' });
    }
  };
}

export const folderController = new FolderController();
