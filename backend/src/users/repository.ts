import { Prisma, PrismaClient } from '@prisma/client';
import { userFields } from '../auth/repository.js';
import { ApiError } from '../errors.js';
import type { UserQuery } from './schemas.js';

export const activeAdmin = { role: { code: 'admin' }, isBlocked: false };

export class UserRepository {
  constructor(readonly db: PrismaClient) {}

  detail(id: string) {
    return this.db.$transaction(
      [
        this.db.user.findUnique({ where: { id }, select: userFields }),
        this.db.user.count({ where: activeAdmin }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
  }

  list(query: UserQuery) {
    const where: Prisma.UserWhereInput = {
      OR: [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ],
      ...(query.role ? { role: { code: query.role } } : {}),
      ...(query.status ? { isBlocked: query.status === 'blocked' } : {}),
    };
    return this.db.$transaction(
      [
        this.db.user.findMany({
          where,
          select: userFields,
          orderBy: [{ [query.sort]: query.order }, { id: 'asc' }],
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        this.db.user.count({ where }),
        this.db.user.count({ where: activeAdmin }),
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
        if (error.code === 'P2025') throw new ApiError(404, 'NOT_FOUND', 'User not found');
        throw error;
      }
    }
    throw new ApiError(409, 'CONCURRENT_CHANGE', 'Retry the operation');
  }
}
