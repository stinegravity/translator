import prisma from '../infrastructure/db';

export class FolderRepository {
  private getScopedUserId(userId?: string) {
    return userId ?? null;
  }

  async listFolders(userId?: string) {
    return prisma.folder.findMany({
      where: { userId: this.getScopedUserId(userId) },
      orderBy: { name: 'asc' },
    });
  }

  async createFolder(name: string, userId?: string) {
    const scopedUserId = this.getScopedUserId(userId);
    return prisma.folder.upsert({
      where: {
        userId_name: {
          userId: scopedUserId,
          name,
        },
      },
      update: {},
      create: {
        name,
        userId: scopedUserId,
      },
    });
  }

  async deleteFolder(id: string) {
    return prisma.folder.delete({
      where: { id },
    });
  }

  async getFolder(id: string) {
    return prisma.folder.findUnique({
      where: { id },
    });
  }
}

export const folderRepository = new FolderRepository();
