const text = { type: 'string' };
const id = { ...text, format: 'uuid' };
const date = { ...text, format: 'date-time' };
const person = { type: 'object', required: ['id', 'name'], properties: { id, name: text } };
const object = (properties: Record<string, object>) => ({
  type: 'object',
  required: Object.keys(properties),
  properties,
});
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: object, description = 'Success') => ({
  description,
  content: { 'application/json': { schema } },
});
const errors = Object.fromEntries(
  [400, 401, 403, 422, 500].map((code) => [
    code,
    json(
      ref('Error'),
      code === 422 ? 'VALIDATION_ERROR: invalid fields or from > to' : 'Request failed',
    ),
  ]),
);
const parameter = (name: string, schema: object) => ({ name, in: 'query', schema });
const paging = [
  parameter('page', { type: 'integer', minimum: 1, maximum: 100000, default: 1 }),
  parameter('pageSize', { type: 'integer', minimum: 1, maximum: 100, default: 20 }),
  parameter('search', { ...text, maxLength: 200 }),
  parameter('actorId', id),
  parameter('actorSearch', {
    ...text,
    maxLength: 100,
    description: 'Case-insensitive actor name substring, including blocked accounts',
  }),
  parameter('order', { type: 'string', enum: ['asc', 'desc'], default: 'desc' }),
  ...['from', 'to'].map((name) =>
    parameter(name, {
      ...date,
      description: 'Inclusive timestamp with timezone; normalized to UTC',
    }),
  ),
];
const list = (name: string) =>
  json(
    object({
      data: { type: 'array', items: ref(name) },
      total: { type: 'integer', minimum: 0 },
      page: { type: 'integer', minimum: 1 },
      pageSize: { type: 'integer', minimum: 1, maximum: 100 },
    }),
  );
const security = [{ bearerAuth: [] }];

export const historySchemas = {
  Movement: object({
    id,
    equipmentId: id,
    fromRoomId: id,
    toRoomId: id,
    actorId: id,
    reason: { ...text, maxLength: 1000 },
    createdAt: date,
    equipment: object({ id, name: text, inventoryNumber: text }),
    fromRoom: ref('Room'),
    toRoom: ref('Room'),
    actor: person,
  }),
  AuditEntry: object({
    id,
    actorId: id,
    actor: person,
    action: text,
    entityType: { ...text, nullable: true },
    entityId: { ...id, nullable: true },
    details: { type: 'object', nullable: true, additionalProperties: true },
    subject: {
      ...text,
      nullable: true,
      description:
        'Current display name/number. Null if the referenced object was deleted or cannot be resolved. Account events use actor name.',
    },
    createdAt: date,
  }),
};
export const historyPaths = {
  '/movements': {
    get: {
      summary: 'Read movement history; technician or admin',
      tags: ['History'],
      security,
      description:
        'Reads the existing Movement records created when roomId changes through equipment PATCH. Read-only: no new movement operation is introduced. Search matches equipment name, inventory number or reason. Filters are ANDed. Pagination/count use a repeatable-read snapshot, stable order createdAt then id asc. Unknown query fields are rejected.',
      parameters: [
        ...paging,
        ...['equipmentId', 'fromRoomId', 'toRoomId'].map((name) => parameter(name, id)),
        parameter('sort', { type: 'string', enum: ['createdAt'], default: 'createdAt' }),
      ],
      responses: { 200: list('Movement'), ...errors },
    },
  },
  '/audit': {
    get: {
      summary: 'Read global audit; admin only',
      tags: ['History'],
      security,
      description:
        'Reads existing account and domain audit records. Search matches action code or actor name; action and entity filters are exact. entityType=account selects legacy events with null entityType. Includes current subject names where available, never passwords, tokens, sessions or file bytes. No mutation routes. Stable order uses id asc as tie-breaker.',
      parameters: [
        ...paging,
        parameter('entityId', id),
        parameter('entityType', { ...text, minLength: 1, maxLength: 50 }),
        parameter('action', { ...text, minLength: 1, maxLength: 100 }),
        parameter('sort', {
          type: 'string',
          enum: ['createdAt', 'action'],
          default: 'createdAt',
        }),
      ],
      responses: { 200: list('AuditEntry'), ...errors },
    },
  },
};
