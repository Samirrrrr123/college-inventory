import { PrismaClient } from '@prisma/client';

export const metadata = {
  id: true,
  equipmentId: true,
  uploadedById: true,
  name: true,
  contentType: true,
  size: true,
  createdAt: true,
} as const;

export class FileRepository {
  constructor(readonly db: PrismaClient) {}

  equipment(id: string) {
    return this.db.equipment.findUnique({ where: { id }, select: { id: true } });
  }

  list(
    equipmentId: string,
    query: {
      search: string;
      page: number;
      pageSize: number;
      order: 'asc' | 'desc';
      sort: 'name' | 'createdAt';
    },
  ) {
    const where = {
      equipmentId,
      name: { contains: query.search, mode: 'insensitive' as const },
    };
    return this.db.$transaction(
      [
        this.db.attachment.findMany({
          where,
          select: metadata,
          orderBy: [{ [query.sort]: query.order }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        this.db.attachment.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
  }

  find(equipmentId: string, id: string) {
    return this.db.attachment.findFirst({ where: { id, equipmentId } });
  }

  create(
    equipmentId: string,
    uploadedById: string,
    name: string,
    contentType: string,
    content: Buffer,
  ) {
    return this.db.$transaction(async (tx) => {
      const file = await tx.attachment.create({
        data: {
          equipmentId,
          uploadedById,
          name,
          contentType,
          size: content.length,
          content: new Uint8Array(content),
        },
        select: metadata,
      });
      await tx.auditEntry.create({
        data: {
          actorId: uploadedById,
          action: 'fileUploaded',
          entityType: 'equipment',
          entityId: equipmentId,
          details: { fileId: file.id, name },
        },
      });
      return file;
    });
  }

  remove(equipmentId: string, id: string, actorId: string) {
    return this.db.$transaction(async (tx) => {
      const deleted = await tx.attachment.deleteMany({ where: { id, equipmentId } });
      if (deleted.count)
        await tx.auditEntry.create({
          data: {
            actorId,
            action: 'fileDeleted',
            entityType: 'equipment',
            entityId: equipmentId,
            details: { fileId: id },
          },
        });
      return deleted.count;
    });
  }
}
