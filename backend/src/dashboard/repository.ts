import { PrismaClient } from '@prisma/client';

const person = { select: { id: true, name: true } } as const;
const items = {
  select: { equipment: { select: { id: true, name: true, inventoryNumber: true } } },
  orderBy: { equipmentId: 'asc' },
} as const;

export class DashboardRepository {
  constructor(readonly db: PrismaClient) {}

  summary(userId: string | undefined, now: Date) {
    const requests = userId ? { requesterId: userId } : {};
    const loans = userId ? { recipientId: userId } : {};
    const overdue = { ...loans, returnedAt: null, dueAt: { lt: now } };
    const groups = this.db.equipment.groupBy({
      by: ['status'],
      orderBy: { status: 'asc' },
      _count: { _all: true },
    });
    return this.db.$transaction(
      [
        groups,
        this.db.room.count(),
        this.db.loan.count({ where: { ...loans, returnedAt: null } }),
        this.db.loan.count({ where: overdue }),
        this.db.equipmentRequest.count({ where: { ...requests, status: 'pending' } }),
        this.db.equipmentRequest.findMany({
          where: requests,
          select: {
            id: true,
            number: true,
            status: true,
            createdAt: true,
            requester: person,
            items,
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          take: 3,
        }),
        this.db.loan.findMany({
          where: overdue,
          select: { id: true, number: true, dueAt: true, recipient: person, items },
          orderBy: [{ dueAt: 'asc' }, { id: 'asc' }],
          take: 3,
        }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
