import express from 'express';
import type { ErrorRequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import type { Config } from './config.js';
import { AuthService } from './auth/service.js';
import { authController } from './auth/controller.js';
import { ApiError } from './errors.js';
import { openapi } from './openapi.js';
import { catalogController } from './catalog/controller.js';
import { circulationController } from './circulation/controller.js';
import { fileController } from './files/controller.js';
import { inventoryController } from './inventory/controller.js';
import { userController } from './users/controller.js';
import { dashboardController } from './dashboard/controller.js';
import { reportController } from './reports/controller.js';
import { historyController } from './history/controller.js';

export function createApp(service: AuthService, config: Config) {
  const app = express();
  app.set('trust proxy', config.TRUST_PROXY_HOPS);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: config.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', (req, _res, next) => {
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.headers.origin !== config.CLIENT_ORIGIN
    )
      throw new ApiError(403, 'ORIGIN_DENIED', 'The request origin is not allowed');
    next();
  });
  app.use(
    '/api/auth',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: config.NODE_ENV === 'test' ? 1000 : 100,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again later' },
      },
    }),
  );
  app.get('/api/health', async (_req, res) => {
    await service.repository.db.$queryRaw`SELECT 1`;
    res.json({ data: { status: 'ok' } });
  });
  app.get('/api/openapi.json', (_req, res) => res.json(openapi));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi));
  app.use('/api', reportController(service));
  app.use('/api', catalogController(service));
  app.use('/api', circulationController(service));
  app.use('/api', fileController(service));
  app.use('/api', inventoryController(service));
  app.use('/api', userController(service));
  app.use('/api', dashboardController(service));
  app.use('/api', historyController(service));
  app.use('/api', authController(service, config));
  app.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'Resource not found')));
  const handleError: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (error instanceof ZodError) {
      const fields = Object.fromEntries(
        error.issues.map((issue) => [issue.path.join('.'), issue.message]),
      );
      res
        .status(422)
        .json({ error: { code: 'VALIDATION_ERROR', message: 'Check the fields', fields } });
    } else if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      res
        .status(409)
        .json({ error: { code: 'EMAIL_EXISTS', message: 'This email is already in use' } });
    } else if (error instanceof ApiError) {
      res.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
        },
      });
    } else if (error instanceof SyntaxError && 'body' in error) {
      res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } });
    } else if (
      typeof error === 'object' &&
      error &&
      'type' in error &&
      error.type === 'entity.too.large'
    ) {
      res
        .status(413)
        .json({ error: { code: 'BODY_TOO_LARGE', message: 'Request body is too large' } });
    } else {
      console.error(
        'Unhandled API error',
        error instanceof Error ? error.name : 'UnknownError',
      );
      res
        .status(500)
        .json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } });
    }
  };
  app.use(handleError);
  return app;
}
