import { Prisma, PrismaClient } from '@prisma/client';
import { ApiError } from '../errors.js';
import type { CheckQuery, ItemQuery } from './schemas.js';

export const relations = {
  room: { select: { id: true, number: true, name: true, building: true } },
  createdBy: { select: { id: true, name: true } },
  completedBy: { select: { id: true, name: true } },
  _count: { select: { items: true } },
} as const;

export class InventoryRepository {
  constructor(readonly db: PrismaClient) {}

  list(query: CheckQuery) {
    const where: Prisma.InventoryCheckWhereInput = {
      ...(query.roomId ? { roomId: query.roomId } : {}),
      ...(query.status
        ? { completedAt: query.status === 'active' ? null : { not: null } }
        : {}),
      ...(query.search
        ? {
            OR: [
              { room: { number: { contains: query.search, mode: 'insensitive' } } },
              { room: { name: { contains: query.search, mode: 'insensitive' } } },
              { room: { building: { contains: query.search, mode: 'insensitive' } } },
              { createdBy: { name: { contains: query.search, mode: 'insensitive' } } },
              ...(/^\d{1,9}$/u.test(query.search) ? [{ number: Number(query.search) }] : []),
            ],
          }
        : {}),
    };
    return this.db.$transaction(
      [
        this.db.inventoryCheck.findMany({
          where,
          include: relations,
          orderBy: [{ [query.sort]: query.order }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        this.db.inventoryCheck.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
  }

  detail(id: string) {
    return this.db.$transaction(
      async (tx) => {
        const check = await tx.inventoryCheck.findUnique({
          where: { id },
          include: relations,
        });
        if (!check) return null;
        const groups = await tx.inventoryItem.groupBy({
          by: ['found'],
          where: { checkId: id },
          _count: true,
        });
        const count = (found: boolean | null) =>
          groups.find((group) => group.found === found)?._count ?? 0;
        return {
          ...check,
          summary: {
            total: check._count.items,
            found: count(true),
            missing: count(false),
            pending: count(null),
          },
        };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  items(checkId: string, query: ItemQuery) {
    const where: Prisma.InventoryItemWhereInput = {
      checkId,
      ...(query.state
        ? { found: query.state === 'pending' ? null : query.state === 'found' }
        : {}),
      ...(query.search
        ? {
            OR: [
              { equipmentName: { contains: query.search, mode: 'insensitive' } },
              { inventoryNumber: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return this.db.$transaction(
      [
        this.db.inventoryItem.findMany({
          where,
          orderBy: [{ [query.sort]: query.order }, { equipmentId: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        this.db.inventoryItem.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async write<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.db.$transaction(operation, { isolationLevel: 'Serializable' });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError)) throw error;
        if (error.code === 'P2034' && attempt < 2) continue;
        if (error.code === 'P2034')
          throw new ApiError(409, 'CONCURRENT_CHANGE', 'Retry the operation');
        if (['P2003', 'P2025'].includes(error.code))
          throw new ApiError(409, 'RELATED_RECORDS', 'A referenced record changed');
        throw error;
      }
    }
    throw new ApiError(409, 'CONCURRENT_CHANGE', 'Retry the operation');
  }
}
