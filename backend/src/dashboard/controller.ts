import { Router } from 'express';
import type { AuthService } from '../auth/service.js';
import { authenticate } from '../auth/controller.js';
import type { CurrentUser } from '../auth/controller.js';
import { DashboardRepository } from './repository.js';
import { DashboardService } from './service.js';

export function dashboardController(auth: AuthService) {
  const router = Router();
  const service = new DashboardService(new DashboardRepository(auth.repository.db));
  router.get('/dashboard', authenticate(auth), async (_req, res) => {
    const user = (res.locals.auth as CurrentUser).user;
    res.json(await service.summary({ id: user.id, role: user.role.code }));
  });
  return router;
}
