import { Router } from 'express';
import { AuthService } from '../auth/service.js';
import { authenticate, requireRoles } from '../auth/controller.js';
import type { CurrentUser } from '../auth/controller.js';
import type { Request, Response } from 'express';
import { CatalogService } from './service.js';
import { CatalogRepository } from './repository.js';
import {
  identifier,
  categoryInput,
  categoryPatch,
  categoryQuery,
  equipmentInput,
  equipmentPatch,
  equipmentQuery,
  roomInput,
  roomPatch,
  roomQuery,
} from './schemas.js';

export function catalogController(authService: AuthService) {
  const router = Router();
  const service = new CatalogService(new CatalogRepository(authService.repository.db));
  const id = (req: Request) => identifier.parse(req.params.id);
  const actor = (res: Response) => (res.locals.auth as CurrentUser).user.id;
  const read = requireRoles('teacher', 'technician', 'admin');
  const write = requireRoles('technician', 'admin');
  router.use(['/equipment', '/categories', '/rooms'], authenticate(authService));
  router.get('/equipment', read, async (req, res) =>
    res.json(await service.equipment(equipmentQuery.parse(req.query))),
  );
  router.get('/equipment/:id', read, async (req, res) =>
    res.json({ data: await service.equipmentById(id(req)) }),
  );
  router.post('/equipment', write, async (req, res) =>
    res.status(201).json({
      data: await service.createEquipment(equipmentInput.parse(req.body), actor(res)),
    }),
  );
  router.patch('/equipment/:id', write, async (req, res) =>
    res.json({
      data: await service.updateEquipment(id(req), equipmentPatch.parse(req.body), actor(res)),
    }),
  );
  router.delete('/equipment/:id', write, async (req, res) => {
    await service.deleteEquipment(id(req), actor(res));
    res.status(204).end();
  });
  router.get('/categories', read, async (req, res) =>
    res.json(await service.categories(categoryQuery.parse(req.query))),
  );
  router.get('/categories/:id', read, async (req, res) =>
    res.json({ data: await service.categoryById(id(req)) }),
  );
  router.post('/categories', write, async (req, res) =>
    res
      .status(201)
      .json({ data: await service.createCategory(categoryInput.parse(req.body), actor(res)) }),
  );
  router.patch('/categories/:id', write, async (req, res) =>
    res.json({
      data: await service.updateCategory(id(req), categoryPatch.parse(req.body), actor(res)),
    }),
  );
  router.delete('/categories/:id', write, async (req, res) => {
    await service.deleteCategory(id(req), actor(res));
    res.status(204).end();
  });
  router.get('/rooms', read, async (req, res) =>
    res.json(await service.rooms(roomQuery.parse(req.query))),
  );
  router.get('/rooms/:id', read, async (req, res) =>
    res.json({ data: await service.roomById(id(req)) }),
  );
  router.post('/rooms', write, async (req, res) =>
    res
      .status(201)
      .json({ data: await service.createRoom(roomInput.parse(req.body), actor(res)) }),
  );
  router.patch('/rooms/:id', write, async (req, res) =>
    res.json({
      data: await service.updateRoom(id(req), roomPatch.parse(req.body), actor(res)),
    }),
  );
  router.delete('/rooms/:id', write, async (req, res) => {
    await service.deleteRoom(id(req), actor(res));
    res.status(204).end();
  });
  return router;
}
