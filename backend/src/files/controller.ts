import { Router, raw } from 'express';
import type { Response } from 'express';
import { z } from 'zod';
import type { AuthService } from '../auth/service.js';
import { authenticate, requireRoles } from '../auth/controller.js';
import type { CurrentUser } from '../auth/controller.js';
import { ApiError } from '../errors.js';
import { FileRepository } from './repository.js';
import { FileService, maxFileSize } from './service.js';

const id = z.uuid().transform((value) => value.toLowerCase());
const query = z
  .object({
    search: z.string().trim().max(200).default(''),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(['name', 'createdAt']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();

export function fileController(auth: AuthService) {
  const router = Router();
  const service = new FileService(new FileRepository(auth.repository.db));
  const actor = (res: Response) => {
    const user = (res.locals.auth as CurrentUser).user;
    return { id: user.id, role: user.role.code };
  };
  const root = '/equipment/:equipmentId/files';
  router.use(root, authenticate(auth), requireRoles('teacher', 'technician', 'admin'));
  router.get(root, async (req, res) =>
    res.json(await service.list(id.parse(req.params.equipmentId), query.parse(req.query))),
  );
  router.post(
    root,
    requireRoles('technician', 'admin'),
    raw({ type: '*/*', limit: maxFileSize }),
    async (req, res) => {
      let name: string;
      try {
        name = decodeURIComponent(req.get('X-File-Name') ?? '');
      } catch {
        throw new ApiError(422, 'INVALID_FILE_NAME', 'Invalid file name');
      }
      res.status(201).json({
        data: await service.upload(
          id.parse(req.params.equipmentId),
          actor(res),
          name,
          req.get('Content-Type')?.split(';')[0].trim().toLowerCase() ?? '',
          req.body,
        ),
      });
    },
  );
  router.get(`${root}/:fileId`, async (req, res) => {
    const file = await service.download(
      id.parse(req.params.equipmentId),
      id.parse(req.params.fileId),
    );
    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/['()*]/gu, (c) => `%${c.charCodeAt(0).toString(16)}`)}`,
    );
    res.setHeader('Content-Length', file.size);
    res.send(Buffer.from(file.content));
  });
  router.delete(`${root}/:fileId`, requireRoles('technician', 'admin'), async (req, res) => {
    await service.remove(
      id.parse(req.params.equipmentId),
      id.parse(req.params.fileId),
      actor(res),
    );
    res.status(204).end();
  });
  return router;
}
