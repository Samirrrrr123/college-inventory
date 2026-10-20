const string = { type: 'string' };
const password = { type: 'string', minLength: 8, maxLength: 72, format: 'password' };
const profile = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'email'],
  properties: {
    name: { ...string, minLength: 2, maxLength: 100 },
    email: { ...string, format: 'email' },
  },
};
const user = {
  type: 'object',
  required: ['id', 'name', 'email', 'role', 'isBlocked'],
  properties: {
    id: { ...string, format: 'uuid' },
    name: string,
    email: string,
    role: { type: 'string', enum: ['teacher', 'technician', 'admin'] },
    isBlocked: { type: 'boolean' },
  },
};
const response = (schema: object) => ({
  description: 'Success',
  content: { 'application/json': { schema } },
});
const data = (schema: object) => ({
  type: 'object',
  properties: { data: schema },
  required: ['data'],
});
const errors = Object.fromEntries(
  [400, 401, 403, 409, 413, 422, 429, 500].map((status) => [
    status,
    {
      description: 'Request failed',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
    },
  ]),
);
const body = (schema: object) => ({
  required: true,
  content: { 'application/json': { schema } },
});
const mutation = (summary: string, schema: object, success: object, status = 200) => ({
  summary,
  description:
    'Send the configured CLIENT_ORIGIN in the Origin header. Additional body properties are rejected.',
  requestBody: body(schema),
  responses: { [status]: success, ...errors },
});
const tokenResponse = response(
  data({ type: 'object', properties: { accessToken: string }, required: ['accessToken'] }),
);
const pagination = ['page', 'pageSize'].map((name) => ({
  in: 'query',
  name,
  schema: {
    type: 'integer',
    minimum: 1,
    ...(name === 'pageSize' ? { maximum: 100, default: 20 } : { default: 1 }),
  },
}));

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Инвентарь — API аккаунтов',
    version: '0.1.0',
    description:
      'Accounts, sessions and personal activity are implemented. Equipment, loans, uploads and exports are not implemented by this module. Reset links are printed in server logs for the educational assignment.',
  },
  servers: [{ url: '/api' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      refreshCookie: { type: 'apiKey', in: 'cookie', name: 'inventory_refresh' },
    },
    schemas: {
      User: user,
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: string,
              message: string,
              fields: { type: 'object', additionalProperties: string },
            },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Database readiness',
        responses: {
          200: response(data({ type: 'object', properties: { status: string } })),
          ...errors,
        },
      },
    },
    '/auth/register': {
      post: mutation(
        'Register a teacher account',
        {
          ...profile,
          required: ['name', 'email', 'password'],
          properties: { ...profile.properties, password },
        },
        response(data(user)),
        201,
      ),
    },
    '/auth/login': {
      post: {
        ...mutation(
          'Sign in',
          {
            type: 'object',
            additionalProperties: false,
            required: ['email', 'password'],
            properties: {
              email: { ...string, format: 'email' },
              password: { ...password, minLength: 1 },
            },
          },
          tokenResponse,
        ),
        description:
          'Sets inventory_refresh: HttpOnly; SameSite=Lax; Path=/api/auth; Secure in production. Access token expires in 15 minutes; refresh token in 7 days. Send Origin matching CLIENT_ORIGIN.',
      },
    },
    '/auth/refresh': {
      post: {
        summary: 'Rotate refresh token',
        description:
          'Requires refresh cookie and allowed Origin. The previous refresh token cannot be reused.',
        security: [{ refreshCookie: [] }],
        responses: { 200: tokenResponse, ...errors },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Revoke current session and clear cookie',
        description: 'Requires allowed Origin; repeat logout is safe.',
        security: [{ refreshCookie: [] }],
        responses: { 204: { description: 'Signed out' }, ...errors },
      },
    },
    '/auth/forgot-password': {
      post: mutation(
        'Request a password reset',
        {
          type: 'object',
          additionalProperties: false,
          required: ['email'],
          properties: { email: { ...string, format: 'email' } },
        },
        response(data({ type: 'object', properties: { message: string } })),
        202,
      ),
    },
    '/auth/reset-password': {
      post: mutation(
        'Consume a reset link and revoke all sessions',
        {
          type: 'object',
          additionalProperties: false,
          required: ['token', 'password'],
          properties: { token: { ...string, pattern: '^[a-f0-9]{64}$' }, password },
        },
        { description: 'Password changed' },
        204,
      ),
    },
    '/me': {
      get: {
        summary: 'Current user',
        security: [{ bearerAuth: [] }],
        responses: { 200: response(data(user)), ...errors },
      },
      patch: {
        ...mutation('Edit own name and email', profile, response(data(user))),
        security: [{ bearerAuth: [] }],
      },
    },
    '/me/password': {
      patch: {
        ...mutation(
          'Change own password and revoke all sessions',
          {
            type: 'object',
            additionalProperties: false,
            required: ['currentPassword', 'password'],
            properties: { currentPassword: { ...password, minLength: 1 }, password },
          },
          { description: 'Password changed; sign in again' },
          204,
        ),
        security: [{ bearerAuth: [] }],
      },
    },
    '/me/activity': {
      get: {
        summary: 'Own account activity only',
        security: [{ bearerAuth: [] }],
        parameters: pagination,
        responses: {
          200: response({
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: string,
                    actorId: string,
                    action: string,
                    createdAt: { ...string, format: 'date-time' },
                  },
                },
              },
              total: { type: 'integer' },
              page: { type: 'integer' },
              pageSize: { type: 'integer' },
            },
          }),
          ...errors,
        },
      },
    },
    '/users': {
      get: {
        summary: 'User list for administrators',
        security: [{ bearerAuth: [] }],
        parameters: [
          ...pagination,
          ...['search', 'role', 'sort', 'order'].map((name) => ({
            in: 'query',
            name,
            schema: {
              type: 'string',
              ...(name === 'role'
                ? { enum: ['teacher', 'technician', 'admin'] }
                : name === 'sort'
                  ? { enum: ['name', 'email'] }
                  : name === 'order'
                    ? { enum: ['asc', 'desc'] }
                    : {}),
            },
          })),
        ],
        responses: {
          200: response({
            type: 'object',
            properties: {
              data: { type: 'array', items: user },
              total: { type: 'integer' },
              page: { type: 'integer' },
              pageSize: { type: 'integer' },
            },
          }),
          ...errors,
        },
      },
    },
  },
};
