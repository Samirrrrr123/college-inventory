import { Router } from 'express';
import type { Response } from 'express';
import type { AuthService } from '../auth/service.js';
import { authenticate, requireRoles } from '../auth/controller.js';
import type { CurrentUser } from '../auth/controller.js';
import { InventoryRepository } from './repository.js';
import { InventoryService } from './service.js';
import { id, checkQuery, itemQuery, createInput, itemInput, emptyInput } from './schemas.js';

export function inventoryController(auth: AuthService) {
  const router = Router();
  const service = new InventoryService(new InventoryRepository(auth.repository.db));
  const actor = (res: Response) => {
    const { user } = res.locals.auth as CurrentUser;
    return { id: user.id, role: user.role.code };
  };
  const root = '/inventory-checks';
  router.use(root, authenticate(auth), requireRoles('technician', 'admin'));
  router.get(root, async (req, res) =>
    res.json(await service.list(checkQuery.parse(req.query), actor(res))),
  );
  router.post(root, async (req, res) =>
    res
      .status(201)
      .json({ data: await service.create(createInput.parse(req.body).roomId, actor(res)) }),
  );
  router.get(`${root}/:id`, async (req, res) =>
    res.json({ data: await service.detail(id.parse(req.params.id), actor(res)) }),
  );
  router.get(`${root}/:id/items`, async (req, res) =>
    res.json(
      await service.items(id.parse(req.params.id), itemQuery.parse(req.query), actor(res)),
    ),
  );
  router.patch(`${root}/:id/items/:equipmentId`, async (req, res) =>
    res.json({
      data: await service.mark(
        id.parse(req.params.id),
        id.parse(req.params.equipmentId),
        itemInput.parse(req.body).found,
        actor(res),
      ),
    }),
  );
  router.post(`${root}/:id/complete`, async (req, res) => {
    emptyInput.parse(req.body);
    res.json({ data: await service.complete(id.parse(req.params.id), actor(res)) });
  });
  return router;
}
