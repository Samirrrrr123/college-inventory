import { Router } from 'express';
import type { Response } from 'express';
import type { AuthService } from '../auth/service.js';
import { authenticate, requireRoles } from '../auth/controller.js';
import type { CurrentUser } from '../auth/controller.js';
import { HistoryRepository } from './repository.js';
import { HistoryService } from './service.js';
import { auditQuery, movementQuery } from './schemas.js';

export function historyController(auth: AuthService) {
  const router = Router();
  const service = new HistoryService(new HistoryRepository(auth.repository.db));
  const actor = (res: Response) => {
    const user = (res.locals.auth as CurrentUser).user;
    return { id: user.id, role: user.role.code };
  };
  router.use(['/audit', '/movements'], authenticate(auth));
  router.get('/audit', requireRoles('admin'), async (req, res) =>
    res.json(await service.audit(auditQuery.parse(req.query), actor(res))),
  );
  router.get('/movements', requireRoles('technician', 'admin'), async (req, res) =>
    res.json(await service.movements(movementQuery.parse(req.query), actor(res))),
  );
  return router;
}
