import { Prisma, PrismaClient } from '@prisma/client';
import type {
  CategoryInput,
  CategoryQuery,
  EquipmentInput,
  EquipmentPatch,
  EquipmentQuery,
  RoomInput,
  RoomPatch,
  RoomQuery,
} from './schemas.js';
import { ApiError } from '../errors.js';

const equipmentRelations = { category: true, room: true } as const;
type EquipmentGuard = (equipment: { status: string; roomId: string }) => void;

export function equipmentWhere(
  query: Pick<EquipmentQuery, 'search' | 'categoryId' | 'roomId' | 'status'>,
): Prisma.EquipmentWhereInput {
  return {
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { inventoryNumber: { contains: query.search, mode: 'insensitive' } },
            { serialNumber: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.roomId ? { roomId: query.roomId } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
}

export class CatalogRepository {
  constructor(readonly db: PrismaClient) {}

  listEquipment(query: EquipmentQuery) {
    const where = equipmentWhere(query);
    return this.db.$transaction(
      [
        this.db.equipment.findMany({
          where,
          include: equipmentRelations,
          orderBy: [{ [query.sort]: query.order }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        this.db.equipment.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
  }

  findEquipment(id: string) {
    return this.db.equipment.findUnique({ where: { id }, include: equipmentRelations });
  }

  createEquipment(input: EquipmentInput, actorId: string) {
    return this.write(async (tx) => {
      const equipment = await tx.equipment.create({
        data: input,
        include: equipmentRelations,
      });
      await this.record(tx, actorId, 'equipmentCreated', 'equipment', equipment.id, input);
      return equipment;
    });
  }

  updateEquipment(id: string, input: EquipmentPatch, actorId: string, guard: EquipmentGuard) {
    return this.write(async (tx) => {
      const previous = await tx.equipment.findUnique({ where: { id } });
      if (!previous) throw new ApiError(404, 'NOT_FOUND', 'Equipment not found');
      guard(previous);
      const equipment = await tx.equipment.update({
        where: { id },
        data: input,
        include: equipmentRelations,
      });
      if (input.roomId && previous.roomId !== input.roomId) {
        await tx.movement.create({
          data: {
            equipmentId: id,
            fromRoomId: previous.roomId,
            toRoomId: input.roomId,
            actorId,
            reason: 'Room changed in equipment card',
          },
        });
      }
      await this.record(tx, actorId, 'equipmentUpdated', 'equipment', id, {
        changes: input,
        previous: { status: previous.status, roomId: previous.roomId },
      });
      return equipment;
    });
  }

  deleteEquipment(id: string, actorId: string, guard: EquipmentGuard) {
    return this.write(async (tx) => {
      const current = await tx.equipment.findUnique({ where: { id } });
      if (!current) throw new ApiError(404, 'NOT_FOUND', 'Equipment not found');
      guard(current);
      await tx.equipment.delete({ where: { id } });
      await this.record(tx, actorId, 'equipmentDeleted', 'equipment', id);
    });
  }

  listCategories(query: CategoryQuery) {
    const where: Prisma.CategoryWhereInput = query.search
      ? { name: { contains: query.search, mode: 'insensitive' } }
      : {};
    return this.db.$transaction(
      [
        this.db.category.findMany({
          where,
          orderBy: [{ name: query.order }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        this.db.category.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
  }

  findCategory(id: string) {
    return this.db.category.findUnique({ where: { id } });
  }

  saveCategory(input: Partial<CategoryInput>, actorId: string, id?: string) {
    return this.write(async (tx) => {
      const item = id
        ? await tx.category.update({ where: { id }, data: input })
        : await tx.category.create({ data: input as CategoryInput });
      await this.record(
        tx,
        actorId,
        id ? 'categoryUpdated' : 'categoryCreated',
        'category',
        item.id,
        input,
      );
      return item;
    });
  }

  deleteCategory(id: string, actorId: string) {
    return this.write(async (tx) => {
      await tx.category.delete({ where: { id } });
      await this.record(tx, actorId, 'categoryDeleted', 'category', id);
    });
  }

  listRooms(query: RoomQuery) {
    const where: Prisma.RoomWhereInput = {
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { number: { contains: query.search, mode: 'insensitive' } },
              { building: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.building ? { building: query.building } : {}),
      ...(query.floor !== undefined ? { floor: query.floor } : {}),
    };
    return this.db.$transaction(
      [
        this.db.room.findMany({
          where,
          orderBy: [{ [query.sort]: query.order }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        this.db.room.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
  }

  findRoom(id: string) {
    return this.db.room.findUnique({ where: { id } });
  }

  saveRoom(input: RoomInput | RoomPatch, actorId: string, id?: string) {
    return this.write(async (tx) => {
      const item = id
        ? await tx.room.update({ where: { id }, data: input })
        : await tx.room.create({ data: input as RoomInput });
      await this.record(
        tx,
        actorId,
        id ? 'roomUpdated' : 'roomCreated',
        'room',
        item.id,
        input,
      );
      return item;
    });
  }

  deleteRoom(id: string, actorId: string) {
    return this.write(async (tx) => {
      await tx.room.delete({ where: { id } });
      await this.record(tx, actorId, 'roomDeleted', 'room', id);
    });
  }

  private record(
    tx: Prisma.TransactionClient,
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    details: Prisma.InputJsonObject = {},
  ) {
    return tx.auditEntry.create({ data: { actorId, action, entityType, entityId, details } });
  }

  private async write<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.transaction(operation);
  }

  async transaction<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.db.$transaction(operation, { isolationLevel: 'Serializable' });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
          if (attempt < 2) continue;
          throw new ApiError(
            409,
            'CONCURRENT_CHANGE',
            'The record changed; retry the operation',
          );
        }
        throw error;
      }
    }
    throw new ApiError(409, 'CONCURRENT_CHANGE', 'Retry the operation');
  }
}
