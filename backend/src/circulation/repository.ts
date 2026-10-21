import { Prisma, PrismaClient } from '@prisma/client';
import { ApiError } from '../errors.js';
import type { Actor, LoanQuery, RecipientQuery, RequestQuery } from './schemas.js';

const person = { select: { id: true, name: true, email: true } } as const;
const items = {
  include: {
    equipment: { select: { id: true, name: true, inventoryNumber: true, status: true } },
  },
  orderBy: { equipmentId: 'asc' },
} as const;
export const requestRelations = {
  requester: person,
  reviewer: person,
  items,
  loan: { select: { id: true, number: true, returnedAt: true } },
} as const;
export const loanRelations = {
  recipient: person,
  issuedBy: person,
  returnedBy: person,
  items,
} as const;

export class CirculationRepository {
  constructor(readonly db: PrismaClient) {}

  listRecipients(query: RecipientQuery) {
    const where: Prisma.UserWhereInput = {
      isBlocked: false,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { email: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return this.db.$transaction(
      [
        this.db.user.findMany({
          where,
          select: { id: true, name: true, email: true },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        this.db.user.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
  }

  listRequests(query: RequestQuery, actor: Actor) {
    const where: Prisma.EquipmentRequestWhereInput = {
      ...(actor.role === 'teacher' ? { requesterId: actor.id } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { purpose: { contains: query.search, mode: 'insensitive' } },
              { requester: { name: { contains: query.search, mode: 'insensitive' } } },
              {
                items: {
                  some: {
                    equipment: {
                      OR: [
                        { name: { contains: query.search, mode: 'insensitive' } },
                        { inventoryNumber: { contains: query.search, mode: 'insensitive' } },
                      ],
                    },
                  },
                },
              },
              ...(/^\d{1,9}$/u.test(query.search) ? [{ number: Number(query.search) }] : []),
            ],
          }
        : {}),
    };
    return this.db.$transaction(
      [
        this.db.equipmentRequest.findMany({
          where,
          include: requestRelations,
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          orderBy: [{ [query.sort]: query.order }, { id: 'asc' }],
        }),
        this.db.equipmentRequest.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
  }

  listLoans(query: LoanQuery, actor: Actor) {
    const where: Prisma.LoanWhereInput = {
      ...(actor.role === 'teacher' ? { recipientId: actor.id } : {}),
      ...(query.status === 'returned'
        ? { returnedAt: { not: null } }
        : query.status
          ? { returnedAt: null }
          : {}),
      ...(query.status === 'overdue' ? { dueAt: { lt: new Date() } } : {}),
      ...(query.search
        ? {
            OR: [
              { recipient: { name: { contains: query.search, mode: 'insensitive' } } },
              {
                items: {
                  some: {
                    equipment: {
                      OR: [
                        { name: { contains: query.search, mode: 'insensitive' } },
                        { inventoryNumber: { contains: query.search, mode: 'insensitive' } },
                      ],
                    },
                  },
                },
              },
              ...(/^\d{1,9}$/u.test(query.search) ? [{ number: Number(query.search) }] : []),
            ],
          }
        : {}),
    };
    return this.db.$transaction(
      [
        this.db.loan.findMany({
          where,
          include: loanRelations,
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
          orderBy: [{ [query.sort]: query.order }, { id: 'asc' }],
        }),
        this.db.loan.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
  }

  request(id: string, actor: Actor) {
    return this.db.equipmentRequest.findFirst({
      where: { id, ...(actor.role === 'teacher' ? { requesterId: actor.id } : {}) },
      include: requestRelations,
    });
  }

  loan(id: string, actor: Actor) {
    return this.db.loan.findFirst({
      where: { id, ...(actor.role === 'teacher' ? { recipientId: actor.id } : {}) },
      include: loanRelations,
    });
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
        if (error.code === 'P2002')
          throw new ApiError(409, 'ALREADY_ISSUED', 'This request already has a loan');
        if (error.code === 'P2003')
          throw new ApiError(409, 'RELATED_RECORDS', 'A referenced record changed');
        if (error.code === 'P2025') throw new ApiError(404, 'NOT_FOUND', 'Record not found');
        throw error;
      }
    }
    throw new ApiError(409, 'CONCURRENT_CHANGE', 'Retry the operation');
  }
}
