import { Prisma, PrismaClient } from '@prisma/client';
import type { AuditQuery, MovementQuery } from './schemas.js';

const person = { select: { id: true, name: true } } as const;
const dateRange = (query: { from?: string; to?: string }) => ({
  ...(query.from ? { gte: new Date(query.from) } : {}),
  ...(query.to ? { lte: new Date(query.to) } : {}),
});

async function subjects(
  tx: Prisma.TransactionClient,
  entries: { entityType: string | null; entityId: string | null }[],
) {
  const ids = (kind: string) =>
    entries
      .filter((item) => item.entityType === kind && item.entityId)
      .map((item) => item.entityId!);
  const result = new Map<string, string>();
  for (const item of await tx.equipment.findMany({
    where: { id: { in: ids('equipment') } },
    select: { id: true, name: true, inventoryNumber: true },
  }))
    result.set(`equipment:${item.id}`, `${item.inventoryNumber} · ${item.name}`);
  for (const item of await tx.room.findMany({
    where: { id: { in: ids('room') } },
    select: { id: true, number: true, name: true, building: true },
  }))
    result.set(`room:${item.id}`, `${item.number} · ${item.name} · ${item.building}`);
  for (const item of await tx.category.findMany({
    where: { id: { in: ids('category') } },
    select: { id: true, name: true },
  }))
    result.set(`category:${item.id}`, item.name);
  for (const item of await tx.user.findMany({
    where: { id: { in: ids('user') } },
    select: { id: true, name: true },
  }))
    result.set(`user:${item.id}`, item.name);
  for (const item of await tx.equipmentRequest.findMany({
    where: { id: { in: ids('request') } },
    select: { id: true, number: true },
  }))
    result.set(`request:${item.id}`, `#${item.number}`);
  for (const item of await tx.loan.findMany({
    where: { id: { in: ids('loan') } },
    select: { id: true, number: true },
  }))
    result.set(`loan:${item.id}`, `#${item.number}`);
  for (const item of await tx.inventoryCheck.findMany({
    where: { id: { in: ids('inventory') } },
    select: { id: true, number: true },
  }))
    result.set(`inventory:${item.id}`, `#${item.number}`);
  return result;
}

export class HistoryRepository {
  constructor(readonly db: PrismaClient) {}

  audit(query: AuditQuery) {
    const where: Prisma.AuditEntryWhereInput = {
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.actorSearch
        ? { actor: { name: { contains: query.actorSearch, mode: 'insensitive' } } }
        : {}),
      ...(query.entityId ? { entityId: query.entityId } : {}),
      ...(query.entityType
        ? { entityType: query.entityType === 'account' ? null : query.entityType }
        : {}),
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
      async (tx) => {
        const entries = await tx.auditEntry.findMany({
          where,
          include: { actor: person },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          orderBy: [{ [query.sort]: query.order }, { id: 'asc' }],
        });
        const total = await tx.auditEntry.count({ where });
        const names = await subjects(tx, entries);
        return [
          entries.map((item) => ({
            ...item,
            subject: item.entityId
              ? (names.get(`${item.entityType}:${item.entityId}`) ?? null)
              : item.actor.name,
          })),
          total,
        ] as const;
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  movements(query: MovementQuery) {
    const where: Prisma.MovementWhereInput = {
      ...(query.equipmentId ? { equipmentId: query.equipmentId } : {}),
      ...(query.fromRoomId ? { fromRoomId: query.fromRoomId } : {}),
      ...(query.toRoomId ? { toRoomId: query.toRoomId } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
      ...(query.actorSearch
        ? { actor: { name: { contains: query.actorSearch, mode: 'insensitive' } } }
        : {}),
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
          include: {
            equipment: { select: { id: true, name: true, inventoryNumber: true } },
            fromRoom: true,
            toRoom: true,
            actor: person,
          },
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          orderBy: [{ createdAt: query.order }, { id: 'asc' }],
        }),
        this.db.movement.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
