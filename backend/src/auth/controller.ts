import { Router } from 'express';
import type { Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import type { Config } from '../config.js';
import { ApiError } from '../errors.js';
import { AuthService } from './service.js';
import { userFields } from './repository.js';

const name = z.string().trim().min(2).max(100);
const email = z
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
const password = z
  .string()
  .min(8)
  .max(72)
  .refine((value) => Buffer.byteLength(value) <= 72);
const existingPassword = z
  .string()
  .min(1)
  .max(72)
  .refine((value) => Buffer.byteLength(value) <= 72);
const credentials = z.object({ email, password: existingPassword }).strict();
const registration = z.object({ name, email, password }).strict();
const paging = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CurrentUser = Awaited<ReturnType<AuthService['authenticate']>>;

export function publicUser(user: CurrentUser['user']) {
  return { ...user, role: user.role.code };
}

export function authenticate(service: AuthService): RequestHandler {
  return async (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer '))
      throw new ApiError(401, 'UNAUTHORIZED', 'Sign in again');
    res.locals.auth = await service.authenticate(header.slice(7));
    next();
  };
}

export function requireRoles(...roles: string[]): RequestHandler {
  return (_req, res, next) => {
    const auth = res.locals.auth as CurrentUser | undefined;
    if (!auth || !roles.includes(auth.user.role.code))
      throw new ApiError(403, 'FORBIDDEN', 'Insufficient permissions');
    next();
  };
}

function refreshCookie(req: Request): string | undefined {
  const value: unknown = req.cookies?.inventory_refresh;
  return typeof value === 'string' ? value : undefined;
}

export function authController(service: AuthService, config: Config) {
  const router = Router();
  const cookieOptions = {
    httpOnly: true,
    secure: config.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/api/auth',
  };
  const setSession = (
    res: Response,
    tokens: { accessToken: string; refreshToken: string },
  ) => {
    res.cookie('inventory_refresh', tokens.refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 86400000,
    });
    res.json({ data: { accessToken: tokens.accessToken } });
  };
  router.post('/auth/register', async (req, res) => {
    const input = registration.parse(req.body);
    const user = await service.register(input.name, input.email, input.password);
    res.status(201).json({ data: publicUser(user) });
  });
  router.post('/auth/login', async (req, res) => {
    const input = credentials.parse(req.body);
    setSession(res, await service.login(input.email, input.password));
  });
  router.post('/auth/refresh', async (req, res) => {
    const token = refreshCookie(req);
    if (!token) throw new ApiError(401, 'UNAUTHORIZED', 'Sign in again');
    try {
      setSession(res, await service.refresh(token));
    } catch (error) {
      res.clearCookie('inventory_refresh', cookieOptions);
      throw error;
    }
  });
  router.post('/auth/logout', async (req, res) => {
    await service.logout(refreshCookie(req));
    res.clearCookie('inventory_refresh', cookieOptions);
    res.sendStatus(204);
  });
  router.post('/auth/forgot-password', async (req, res) => {
    const input = z.object({ email }).strict().parse(req.body);
    await service.forgotPassword(input.email);
    res
      .status(202)
      .json({ data: { message: 'If this account exists, a reset link has been prepared' } });
  });
  router.post('/auth/reset-password', async (req, res) => {
    const input = z
      .object({ token: z.string().regex(/^[a-f0-9]{64}$/u), password })
      .strict()
      .parse(req.body);
    await service.resetPassword(input.token, input.password);
    res.clearCookie('inventory_refresh', cookieOptions);
    res.sendStatus(204);
  });
  router.use(authenticate(service));
  router.get('/me', (_req, res) => {
    const auth = res.locals.auth as CurrentUser;
    res.json({ data: publicUser(auth.user) });
  });
  router.patch('/me', async (req, res) => {
    const input = z.object({ name, email }).strict().parse(req.body);
    const auth = res.locals.auth as CurrentUser;
    res.json({
      data: publicUser(await service.updateProfile(auth.user.id, input.name, input.email)),
    });
  });
  router.patch('/me/password', async (req, res) => {
    const input = z
      .object({ currentPassword: existingPassword, password })
      .strict()
      .parse(req.body);
    const auth = res.locals.auth as CurrentUser;
    await service.changePassword(auth.user.id, input.currentPassword, input.password);
    res.clearCookie('inventory_refresh', cookieOptions);
    res.sendStatus(204);
  });
  router.get('/me/activity', async (req, res) => {
    const { page, pageSize } = paging.parse(req.query);
    const auth = res.locals.auth as CurrentUser;
    const where = { actorId: auth.user.id };
    const [data, total] = await service.repository.db.$transaction([
      service.repository.db.auditEntry.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      service.repository.db.auditEntry.count({ where }),
    ]);
    res.json({ data, total, page, pageSize });
  });
  router.get('/users', requireRoles('admin'), async (req, res) => {
    const query = paging
      .extend({
        search: z.string().trim().max(100).default(''),
        role: z.enum(['teacher', 'technician', 'admin']).optional(),
        sort: z.enum(['name', 'email']).default('name'),
        order: z.enum(['asc', 'desc']).default('asc'),
      })
      .parse(req.query);
    const where = {
      OR: [
        { name: { contains: query.search, mode: 'insensitive' as const } },
        { email: { contains: query.search, mode: 'insensitive' as const } },
      ],
      ...(query.role ? { role: { code: query.role } } : {}),
    };
    const [users, total] = await service.repository.db.$transaction([
      service.repository.db.user.findMany({
        where,
        select: userFields,
        orderBy: [{ [query.sort]: query.order }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      service.repository.db.user.count({ where }),
    ]);
    res.json({
      data: users.map(publicUser),
      total,
      page: query.page,
      pageSize: query.pageSize,
    });
  });
  return router;
}
