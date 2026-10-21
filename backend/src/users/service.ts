import { ApiError } from '../errors.js';
import { userFields } from '../auth/repository.js';
import { UserRepository, activeAdmin } from './repository.js';
import type { Actor, UserPatch, UserQuery } from './schemas.js';

type User = {
  id: string;
  name: string;
  email: string;
  isBlocked: boolean;
  role: { code: string };
};
const publicUser = (user: User, admins: number) => ({
  ...user,
  role: user.role.code,
  isLastAdmin: user.role.code === 'admin' && !user.isBlocked && admins === 1,
});

export class UserService {
  constructor(readonly repository: UserRepository) {}

  async list(query: UserQuery, actor: Actor) {
    this.requireAdmin(actor);
    const [users, total, admins] = await this.repository.list(query);
    return {
      data: users.map((user) => publicUser(user, admins)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  update(id: string, input: UserPatch, actor: Actor) {
    this.requireAdmin(actor);
    return this.repository.write(async (tx) => {
      const currentActor = await tx.user.findUnique({
        where: { id: actor.id },
        select: userFields,
      });
      if (!currentActor || currentActor.isBlocked || currentActor.role.code !== 'admin')
        throw new ApiError(403, 'FORBIDDEN', 'Administrator access required');
      const user = await tx.user.findUnique({ where: { id }, select: userFields });
      if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found');
      const role = input.role ?? user.role.code;
      const isBlocked = input.isBlocked ?? user.isBlocked;
      const admins = await tx.user.count({ where: activeAdmin });
      if (
        user.role.code === 'admin' &&
        !user.isBlocked &&
        (role !== 'admin' || isBlocked) &&
        admins <= 1
      )
        throw new ApiError(
          409,
          'LAST_ADMIN',
          'The last active administrator must remain active',
        );
      if (role === user.role.code && isBlocked === user.isBlocked)
        return publicUser(user, admins);
      const saved = await tx.user.update({
        where: { id },
        data: { role: { connect: { code: role } }, isBlocked },
        select: userFields,
      });
      await tx.session.deleteMany({ where: { userId: id } });
      await tx.passwordReset.deleteMany({ where: { userId: id } });
      await tx.auditEntry.create({
        data: {
          actorId: actor.id,
          action: 'userAccessChanged',
          entityType: 'user',
          entityId: id,
          details: {
            before: { role: user.role.code, isBlocked: user.isBlocked },
            after: { role, isBlocked },
          },
        },
      });
      return publicUser(saved, await tx.user.count({ where: activeAdmin }));
    });
  }

  private requireAdmin(actor: Actor) {
    if (actor.role !== 'admin')
      throw new ApiError(403, 'FORBIDDEN', 'Administrator access required');
  }
}
