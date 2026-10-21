import { Prisma, PrismaClient } from '@prisma/client';
import { ApiError } from '../errors.js';
import { CatalogRepository, equipmentWhere } from '../catalog/repository.js';
import type { Actor, AuditQuery, ExportQuery, MovementQuery } from './schemas.js';

const person = { select: { id: true, name: true } } as const;
export const movementRelations = {
  equipment: { select: { id: true, name: true, inventoryNumber: true } },
  fromRoom: true,
  toRoom: true,
  actor: person,
} as const;
const dateRange = (query: { from?: string; to?: string }) => ({
  ...(query.from ? { gte: new Date(query.from) } : {}),
  ...(query.to ? { lte: new Date(query.to) } : {}),
});
export const exportLimit = 5000;

export class ReportingRepository {
  constructor(readonly db: PrismaClient) {}

  dashboard(actor: Actor, now: Date, start: Date) {
    const loans = actor.role === 'teacher' ? { recipientId: actor.id } : {};
    const requests = actor.role === 'teacher' ? { requesterId: actor.id } : {};
    return this.db.$transaction(
      async (tx) => ({
        equipment: await tx.equipment.groupBy({ by: ['status'], _count: { _all: true } }),
        activeLoans: await tx.loan.count({ where: { ...loans, returnedAt: null } }),
        overdueLoans: await tx.loan.count({
          where: { ...loans, returnedAt: null, dueAt: { lt: now } },
        }),
        pendingRequests: await tx.equipmentRequest.count({
          where: { ...requests, status: 'pending' },
        }),
        dailyLoans: await tx.$queryRaw<{ date: string; count: number }[]>(Prisma.sql`
        SELECT TO_CHAR("issuedAt", 'YYYY-MM-DD') AS date, COUNT(*)::integer AS count
        FROM "Loan" WHERE "issuedAt" >= ${start} AND "issuedAt" <= ${now}
        ${actor.role === 'teacher' ? Prisma.sql`AND "recipientId" = ${actor.id}::uuid` : Prisma.empty}
        GROUP BY TO_CHAR("issuedAt", 'YYYY-MM-DD')
      `),
      }),
      { isolationLevel: 'RepeatableRead' },
    );
  }

  audit(query: AuditQuery) {
    const where: Prisma.AuditEntryWhereInput = {
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.action ? { action: query.action } : {}),
      createdAt: dateRange(query),
      ...(query.search
        ? {
            OR: [
              { action: { contains: query.search, mode: 'insensitive' } },
              { actor: { name: { contains: query.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    return this.db.$transaction(
      [
        this.db.auditEntry.findMany({
          where,
          include: { actor: person },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          orderBy: [{ [query.sort]: query.order }, { id: 'asc' }],
        }),
        this.db.auditEntry.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
  }

  movements(query: MovementQuery) {
    const where: Prisma.MovementWhereInput = {
      ...(query.equipmentId ? { equipmentId: query.equipmentId } : {}),
      ...(query.fromRoomId ? { fromRoomId: query.fromRoomId } : {}),
      ...(query.toRoomId ? { toRoomId: query.toRoomId } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      createdAt: dateRange(query),
      ...(query.search
        ? {
            OR: [
              { reason: { contains: query.search, mode: 'insensitive' } },
              { equipment: { name: { contains: query.search, mode: 'insensitive' } } },
              {
                equipment: {
                  inventoryNumber: { contains: query.search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
    return this.db.$transaction(
      [
        this.db.movement.findMany({
          where,
          include: movementRelations,
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          orderBy: [{ createdAt: query.order }, { id: 'asc' }],
        }),
        this.db.movement.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
  }

  exportEquipment(query: ExportQuery, actorId: string) {
    return this.db.$transaction(
      async (tx) => {
        const data = await tx.equipment.findMany({
          where: equipmentWhere(query),
          include: { category: true, room: true },
          take: exportLimit + 1,
          orderBy: [{ [query.sort]: query.order }, { id: 'asc' }],
        });
        if (data.length > exportLimit)
          throw new ApiError(
            422,
            'EXPORT_TOO_LARGE',
            'Narrow the filters to at most 5000 records',
          );
        await tx.auditEntry.create({
          data: {
            actorId,
            action: 'equipmentExported',
            entityType: 'equipment',
            details: { filters: query, rows: data.length },
          },
        });
        return data;
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  write<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
    return new CatalogRepository(this.db).transaction(operation);
  }
}
