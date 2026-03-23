import prisma from '../infrastructure/db';

export class FolderRepository {
  async listFolders(userId: string) {
    return prisma.folder.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  }

  async createFolder(name: string, userId: string) {
    return prisma.folder.upsert({
      where: {
        userId_name: {
          userId,
          name,
        },
      },
      update: {},
      create: {
        name,
        userId,
      },
    });
  }

  async deleteFolder(id: string, userId: string) {
    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder || folder.userId !== userId) {
      throw Object.assign(new Error('Folder not found'), { statusCode: 404 });
    }
    return prisma.folder.delete({ where: { id } });
  }

  async getFolder(id: string, userId: string) {
    const folder = await prisma.folder.findUnique({ where: { id } });
    if (!folder || folder.userId !== userId) return null;
    return folder;
  }
}

export const folderRepository = new FolderRepository();
