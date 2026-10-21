import { Router } from 'express';
import type { AuthService } from '../auth/service.js';
import type { CurrentUser } from '../auth/controller.js';
import { authenticate, requireRoles } from '../auth/controller.js';
import { CatalogRepository } from '../catalog/repository.js';
import { exportQuery, ReportService } from './service.js';

export function reportController(auth: AuthService) {
  const router = Router();
  const service = new ReportService(new CatalogRepository(auth.repository.db));
  router.get(
    '/equipment/export',
    authenticate(auth),
    requireRoles('technician', 'admin'),
    async (req, res) => {
      const role = (res.locals.auth as CurrentUser).user.role.code;
      const file = await service.equipment(exportQuery.parse(req.query), role);
      res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.attachment('equipment.xlsx');
      res.send(file);
    },
  );
  return router;
}
