import { PrismaClient } from '@prisma/client';

export const userFields = {
  id: true,
  name: true,
  email: true,
  isBlocked: true,
  role: { select: { code: true } },
} as const;

export class AuthRepository {
  constructor(readonly db: PrismaClient) {}

  findByEmail(email: string) {
    return this.db.user.findUnique({ where: { email }, include: { role: true } });
  }

  createUser(name: string, email: string, passwordHash: string) {
    return this.db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, passwordHash, role: { connect: { code: 'teacher' } } },
        select: userFields,
      });
      await tx.auditEntry.create({ data: { actorId: user.id, action: 'registered' } });
      return user;
    });
  }

  findSession(id: string) {
    return this.db.session.findUnique({
      where: { id },
      include: { user: { select: userFields } },
    });
  }

  rotateSession(id: string, oldHash: string, refreshHash: string, expiresAt: Date) {
    return this.db.session.updateMany({
      where: {
        id,
        refreshHash: oldHash,
        expiresAt: { gt: new Date() },
        user: { isBlocked: false },
      },
      data: { refreshHash, expiresAt },
    });
  }

  async replacePassword(userId: string, passwordHash: string, tokenHash?: string) {
    return this.db.$transaction(async (tx) => {
      if (tokenHash) {
        const consumed = await tx.passwordReset.deleteMany({
          where: { userId, tokenHash, expiresAt: { gt: new Date() } },
        });
        if (consumed.count !== 1) return false;
      }
      await tx.user.update({ where: { id: userId }, data: { passwordHash } });
      await tx.session.deleteMany({ where: { userId } });
      await tx.passwordReset.deleteMany({ where: { userId } });
      await tx.auditEntry.create({ data: { actorId: userId, action: 'passwordChanged' } });
      return true;
    });
  }
}
