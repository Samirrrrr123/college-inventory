import { Router } from 'express';
import type { Response } from 'express';
import type { AuthService } from '../auth/service.js';
import { authenticate, requireRoles } from '../auth/controller.js';
import type { CurrentUser } from '../auth/controller.js';
import { UserRepository } from './repository.js';
import { UserService } from './service.js';
import { id, userInput, userQuery, userPatch } from './schemas.js';

export function userController(auth: AuthService) {
  const router = Router();
  const service = new UserService(new UserRepository(auth.repository.db));
  const actor = (res: Response) => {
    const { user } = res.locals.auth as CurrentUser;
    return { id: user.id, role: user.role.code };
  };
  router.use('/users', authenticate(auth), requireRoles('admin'));
  router.get('/users', async (req, res) =>
    res.json(await service.list(userQuery.parse(req.query), actor(res))),
  );
  router.get('/users/:id', async (req, res) =>
    res.json({ data: await service.detail(id.parse(req.params.id), actor(res)) }),
  );
  router.post('/users', async (req, res) =>
    res
      .status(201)
      .json({ data: await service.create(userInput.parse(req.body), actor(res)) }),
  );
  router.patch('/users/:id', async (req, res) =>
    res.json({
      data: await service.update(
        id.parse(req.params.id),
        userPatch.parse(req.body),
        actor(res),
      ),
    }),
  );
  return router;
}
