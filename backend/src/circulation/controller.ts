import { Router } from 'express';
import type { Response } from 'express';
import { authenticate, requireRoles } from '../auth/controller.js';
import type { CurrentUser } from '../auth/controller.js';
import type { AuthService } from '../auth/service.js';
import { CirculationRepository } from './repository.js';
import { CirculationService } from './service.js';
import {
  decisionInput,
  id,
  loanInput,
  loanQuery,
  requestInput,
  requestQuery,
  recipientQuery,
} from './schemas.js';

export function circulationController(auth: AuthService) {
  const router = Router();
  const service = new CirculationService(new CirculationRepository(auth.repository.db));
  const actor = (res: Response) => {
    const { user } = res.locals.auth as CurrentUser;
    return { id: user.id, role: user.role.code };
  };
  const staff = requireRoles('technician', 'admin');
  router.use(
    ['/requests', '/loans', '/loan-recipients'],
    authenticate(auth),
    requireRoles('teacher', 'technician', 'admin'),
  );
  router.get('/requests', async (req, res) =>
    res.json(await service.requests(requestQuery.parse(req.query), actor(res))),
  );
  router.get('/requests/:id', async (req, res) =>
    res.json({ data: await service.request(id.parse(req.params.id), actor(res)) }),
  );
  router.post('/requests', async (req, res) =>
    res
      .status(201)
      .json({ data: await service.createRequest(requestInput.parse(req.body), actor(res)) }),
  );
  for (const [path, status] of [
    ['approve', 'approved'],
    ['reject', 'rejected'],
  ] as const) {
    router.post(`/requests/:id/${path}`, staff, async (req, res) =>
      res.json({
        data: await service.decide(
          id.parse(req.params.id),
          status,
          decisionInput.parse(req.body).note,
          actor(res),
        ),
      }),
    );
  }
  router.post('/requests/:id/cancel', async (req, res) => {
    decisionInput.pick({}).parse(req.body);
    res.json({ data: await service.cancel(id.parse(req.params.id), actor(res)) });
  });
  router.get('/loans', async (req, res) =>
    res.json(await service.loans(loanQuery.parse(req.query), actor(res))),
  );
  router.get('/loans/:id', async (req, res) =>
    res.json({ data: await service.loan(id.parse(req.params.id), actor(res)) }),
  );
  router.post('/loans', staff, async (req, res) =>
    res.status(201).json({ data: await service.issue(loanInput.parse(req.body), actor(res)) }),
  );
  router.post('/loans/:id/return', staff, async (req, res) => {
    decisionInput.pick({}).parse(req.body);
    res.json({ data: await service.returnLoan(id.parse(req.params.id), actor(res)) });
  });
  router.get('/loan-recipients', staff, async (req, res) =>
    res.json(await service.recipients(recipientQuery.parse(req.query), actor(res))),
  );
  return router;
}
