const text = { type: 'string' };
const id = { ...text, format: 'uuid' };
const role = { type: 'string', enum: ['teacher', 'technician', 'admin'] };
const name = { ...text, minLength: 2, maxLength: 100 };
const email = {
  ...text,
  format: 'email',
  maxLength: 254,
  description: 'Normalized to lowercase; unique',
};
const user = {
  allOf: [
    { $ref: '#/components/schemas/User' },
    {
      type: 'object',
      required: ['isLastAdmin'],
      properties: { isLastAdmin: { type: 'boolean' } },
    },
  ],
};
const security = [{ bearerAuth: [] }];
const response = (schema: object) => ({
  description: 'Success',
  content: { 'application/json': { schema } },
});
const data = { type: 'object', required: ['data'], properties: { data: user } };
const errors = Object.fromEntries(
  [400, 401, 403, 404, 409, 413, 422, 500].map((status) => [
    status,
    {
      description:
        status === 409 ? 'LAST_ADMIN, EMAIL_EXISTS or CONCURRENT_CHANGE' : 'Request failed',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
    },
  ]),
);
const requestBody = (properties: object, required?: string[]) => ({
  required: true,
  content: {
    'application/json': {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties,
        ...(required ? { required } : { minProperties: 1 }),
      },
    },
  },
});
const profile = { name, email, role, isBlocked: { type: 'boolean' } };
const parameter = (name: string, schema: object) => ({ name, in: 'query', schema });

export const userPaths = {
  '/users': {
    get: {
      summary: 'User list; admin only',
      tags: ['Users'],
      security,
      parameters: [
        parameter('page', { type: 'integer', minimum: 1, default: 1 }),
        parameter('pageSize', { type: 'integer', minimum: 1, maximum: 100, default: 20 }),
        parameter('search', { ...text, maxLength: 100 }),
        parameter('role', role),
        parameter('status', { type: 'string', enum: ['active', 'blocked'] }),
        parameter('sort', { type: 'string', enum: ['name', 'email'], default: 'name' }),
        parameter('order', { type: 'string', enum: ['asc', 'desc'], default: 'asc' }),
      ],
      responses: {
        200: response({
          type: 'object',
          required: ['data', 'total', 'page', 'pageSize'],
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
    post: {
      summary: 'Create account; admin only',
      tags: ['Users'],
      security,
      description:
        'Requires allowed Origin and an active administrator, rechecked in transaction. Password is bcrypt-hashed and never returned or logged. isBlocked defaults to false. Does not create a session. Duplicate normalized email gives 409 EMAIL_EXISTS.',
      requestBody: requestBody(
        {
          ...profile,
          isBlocked: { type: 'boolean', default: false },
          password: {
            ...text,
            format: 'password',
            minLength: 8,
            maxLength: 72,
            description: 'Maximum 72 UTF-8 bytes',
          },
        },
        ['name', 'email', 'role', 'password'],
      ),
      responses: { 201: response(data), ...errors },
    },
  },
  '/users/{id}': {
    parameters: [{ name: 'id', in: 'path', required: true, schema: id }],
    get: {
      summary: 'Read user; admin only',
      tags: ['Users'],
      security,
      responses: { 200: response(data), ...errors },
    },
    patch: {
      summary: 'Edit user profile, role and blocking; admin only',
      tags: ['Users'],
      security,
      description:
        'Requires allowed Origin. Last active admin cannot be blocked or demoted, including concurrent changes. Effective changes revoke all target sessions and reset tokens. No-op retains sessions. Fields omitted from PATCH remain unchanged. History is retained: disable accounts instead of deleting them. Password changes use existing account recovery endpoints.',
      requestBody: requestBody(profile),
      responses: { 200: response(data), ...errors },
    },
  },
};
