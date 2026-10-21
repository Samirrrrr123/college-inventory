import { Router } from 'express';
import type { Response } from 'express';
import type { AuthService } from '../auth/service.js';
import { authenticate, requireRoles } from '../auth/controller.js';
import type { CurrentUser } from '../auth/controller.js';
import { ReportingRepository } from './repository.js';
import { ReportingService } from './service.js';
import {
  auditQuery,
  dashboardQuery,
  exportQuery,
  movementInput,
  movementQuery,
} from './schemas.js';

export function reportingController(auth: AuthService) {
  const router = Router();
  const service = new ReportingService(new ReportingRepository(auth.repository.db));
  const actor = (res: Response) => {
    const user = (res.locals.auth as CurrentUser).user;
    return { id: user.id, role: user.role.code };
  };
  router.use(['/dashboard', '/audit', '/movements', '/equipment/export'], authenticate(auth));
  router.get(
    '/dashboard',
    requireRoles('teacher', 'technician', 'admin'),
    async (req, res) => {
      dashboardQuery.parse(req.query);
      res.json({ data: await service.dashboard(actor(res)) });
    },
  );
  router.get('/audit', requireRoles('admin'), async (req, res) =>
    res.json(await service.audit(auditQuery.parse(req.query), actor(res))),
  );
  router.get('/movements', requireRoles('technician', 'admin'), async (req, res) =>
    res.json(await service.movements(movementQuery.parse(req.query), actor(res))),
  );
  router.post('/movements', requireRoles('technician', 'admin'), async (req, res) =>
    res
      .status(201)
      .json({ data: await service.move(movementInput.parse(req.body), actor(res)) }),
  );
  router.get('/equipment/export', requireRoles('technician', 'admin'), async (req, res) => {
    const content = await service.exportEquipment(exportQuery.parse(req.query), actor(res));
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="equipment-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    );
    res.send(content);
  });
  return router;
}
