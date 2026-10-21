import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import { ApiError } from '../errors.js';
import { ReportingRepository, movementRelations } from './repository.js';
import type {
  Actor,
  AuditQuery,
  ExportQuery,
  MovementInput,
  MovementQuery,
} from './schemas.js';

export class ReportingService {
  constructor(readonly repository: ReportingRepository) {}

  async dashboard(actor: Actor, now = new Date()) {
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6),
    );
    const result = await this.repository.dashboard(actor, now, start);
    const equipmentByStatus = { available: 0, issued: 0, repair: 0, written_off: 0 };
    for (const row of result.equipment) equipmentByStatus[row.status] = row._count._all;
    const loansByDay = Array.from({ length: 7 }, (_, index) => ({
      date: new Date(start.getTime() + index * 86400000).toISOString().slice(0, 10),
      count: 0,
    }));
    for (const row of result.dailyLoans) {
      const day = loansByDay.find((item) => item.date === row.date);
      if (day) day.count += row.count;
    }
    return {
      generatedAt: now.toISOString(),
      scope: actor.role === 'teacher' ? 'own' : 'all',
      equipmentByStatus,
      totalEquipment: Object.values(equipmentByStatus).reduce((sum, count) => sum + count, 0),
      activeLoans: result.activeLoans,
      overdueLoans: result.overdueLoans,
      pendingRequests: result.pendingRequests,
      loansByDay,
    };
  }

  async audit(query: AuditQuery, actor: Actor) {
    if (actor.role !== 'admin')
      throw new ApiError(403, 'FORBIDDEN', 'Administrator access required');
    const [data, total] = await this.repository.audit(query);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async movements(query: MovementQuery, actor: Actor) {
    this.staff(actor);
    const [data, total] = await this.repository.movements(query);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async move(input: MovementInput, actor: Actor) {
    this.staff(actor);
    try {
      return await this.repository.write(async (tx) => {
        const equipment = await tx.equipment.findUnique({ where: { id: input.equipmentId } });
        if (!equipment) throw new ApiError(404, 'NOT_FOUND', 'Equipment not found');
        if (equipment.status === 'issued')
          throw new ApiError(
            409,
            'EQUIPMENT_UNAVAILABLE',
            'Return the equipment before moving it',
          );
        if (input.expectedFromRoomId && input.expectedFromRoomId !== equipment.roomId)
          throw new ApiError(
            409,
            'CONCURRENT_CHANGE',
            'Equipment has moved; refresh the card',
          );
        if (equipment.roomId === input.toRoomId)
          throw new ApiError(409, 'SAME_ROOM', 'Choose another room');
        if (!(await tx.room.findUnique({ where: { id: input.toRoomId } })))
          throw new ApiError(404, 'NOT_FOUND', 'Room not found');
        await tx.equipment.update({
          where: { id: equipment.id },
          data: { roomId: input.toRoomId },
        });
        const movement = await tx.movement.create({
          data: {
            equipmentId: equipment.id,
            fromRoomId: equipment.roomId,
            toRoomId: input.toRoomId,
            actorId: actor.id,
            reason: input.reason,
          },
          include: movementRelations,
        });
        await tx.auditEntry.create({
          data: {
            actorId: actor.id,
            action: 'equipmentMoved',
            entityType: 'movement',
            entityId: movement.id,
            details: {
              equipmentId: equipment.id,
              fromRoomId: equipment.roomId,
              toRoomId: input.toRoomId,
              reason: input.reason,
            },
          },
        });
        return movement;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003')
        throw new ApiError(409, 'RELATED_RECORDS', 'A referenced record changed');
      throw error;
    }
  }

  async exportEquipment(query: ExportQuery, actor: Actor) {
    this.staff(actor);
    const items = await this.repository.exportEquipment(query, actor.id);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Инвентарь';
    const sheet = workbook.addWorksheet('Оборудование', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    sheet.columns = [
      { header: 'Инвентарный номер', key: 'inventoryNumber', width: 24 },
      { header: 'Наименование', key: 'name', width: 40 },
      { header: 'Категория', key: 'category', width: 24 },
      { header: 'Корпус', key: 'building', width: 24 },
      { header: 'Аудитория', key: 'room', width: 20 },
      { header: 'Состояние', key: 'status', width: 20 },
      { header: 'Серийный номер', key: 'serialNumber', width: 24 },
      { header: 'Описание', key: 'description', width: 48 },
    ];
    for (const item of items)
      sheet.addRow({
        inventoryNumber: item.inventoryNumber,
        name: item.name,
        category: item.category.name,
        building: item.room.building,
        room: item.room.number,
        status: item.status,
        serialNumber: item.serialNumber ?? '',
        description: item.description,
      });
    sheet.getRow(1).font = { bold: true };
    sheet.autoFilter = { from: 'A1', to: `H${Math.max(1, items.length + 1)}` };
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private staff(actor: Actor) {
    if (!['technician', 'admin'].includes(actor.role))
      throw new ApiError(403, 'FORBIDDEN', 'Staff access required');
  }
}
