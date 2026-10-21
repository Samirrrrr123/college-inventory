import { ApiError } from '../errors.js';
import { InventoryRepository, relations } from './repository.js';
import type { Actor, CheckQuery, ItemQuery } from './schemas.js';

export class InventoryService {
  constructor(readonly repository: InventoryRepository) {}

  async list(query: CheckQuery, actor: Actor) {
    this.requireStaff(actor);
    const [data, total] = await this.repository.list(query);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async detail(id: string, actor: Actor) {
    this.requireStaff(actor);
    const check = await this.repository.detail(id);
    if (!check) throw new ApiError(404, 'NOT_FOUND', 'Inventory check not found');
    return check;
  }

  async items(id: string, query: ItemQuery, actor: Actor) {
    await this.detail(id, actor);
    const [data, total] = await this.repository.items(id, query);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  create(roomId: string, actor: Actor) {
    this.requireStaff(actor);
    return this.repository.write(async (tx) => {
      if (!(await tx.room.findUnique({ where: { id: roomId }, select: { id: true } })))
        throw new ApiError(404, 'NOT_FOUND', 'Room not found');
      const equipment = await tx.equipment.findMany({
        where: { roomId },
        select: { id: true, name: true, inventoryNumber: true, status: true },
      });
      if (!equipment.length)
        throw new ApiError(422, 'NO_EQUIPMENT', 'This room has no equipment');
      const check = await tx.inventoryCheck.create({
        data: {
          roomId,
          createdById: actor.id,
          items: {
            create: equipment.map((item) => ({
              equipmentId: item.id,
              equipmentName: item.name,
              inventoryNumber: item.inventoryNumber,
              statusAtStart: item.status,
            })),
          },
        },
        include: relations,
      });
      await tx.auditEntry.create({
        data: {
          actorId: actor.id,
          action: 'inventoryStarted',
          entityType: 'inventory',
          entityId: check.id,
          details: { roomId, total: equipment.length },
        },
      });
      return check;
    });
  }

  mark(id: string, equipmentId: string, found: boolean, actor: Actor) {
    this.requireStaff(actor);
    return this.repository.write(async (tx) => {
      const check = await tx.inventoryCheck.findUnique({ where: { id } });
      if (!check) throw new ApiError(404, 'NOT_FOUND', 'Inventory check not found');
      if (check.completedAt)
        throw new ApiError(409, 'CHECK_COMPLETED', 'Completed checks cannot be changed');
      const item = await tx.inventoryItem.findUnique({
        where: { checkId_equipmentId: { checkId: id, equipmentId } },
      });
      if (!item) throw new ApiError(404, 'NOT_FOUND', 'This item is not in the check');
      const saved = await tx.inventoryItem.update({
        where: { checkId_equipmentId: { checkId: id, equipmentId } },
        data: { found, checkedAt: new Date() },
      });
      await tx.auditEntry.create({
        data: {
          actorId: actor.id,
          action: 'inventoryItemChecked',
          entityType: 'inventory',
          entityId: id,
          details: { equipmentId, found },
        },
      });
      return saved;
    });
  }

  complete(id: string, actor: Actor) {
    this.requireStaff(actor);
    return this.repository.write(async (tx) => {
      const check = await tx.inventoryCheck.findUnique({ where: { id } });
      if (!check) throw new ApiError(404, 'NOT_FOUND', 'Inventory check not found');
      if (check.completedAt)
        throw new ApiError(409, 'CHECK_COMPLETED', 'This check is already completed');
      if (await tx.inventoryItem.count({ where: { checkId: id, found: null } }))
        throw new ApiError(
          409,
          'CHECK_INCOMPLETE',
          'Mark every item before completing the check',
        );
      const saved = await tx.inventoryCheck.update({
        where: { id },
        data: { completedAt: new Date(), completedById: actor.id },
        include: relations,
      });
      await tx.auditEntry.create({
        data: {
          actorId: actor.id,
          action: 'inventoryCompleted',
          entityType: 'inventory',
          entityId: id,
        },
      });
      return saved;
    });
  }

  private requireStaff(actor: Actor) {
    if (!['technician', 'admin'].includes(actor.role))
      throw new ApiError(403, 'FORBIDDEN', 'Staff access required');
  }
}
