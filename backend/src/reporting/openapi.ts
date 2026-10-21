const id = { type: 'string', format: 'uuid' };
const text = { type: 'string' };
const date = { type: 'string', format: 'date-time' };
const count = { type: 'integer', minimum: 0 };
const person = { type: 'object', required: ['id', 'name'], properties: { id, name: text } };
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const object = (properties: Record<string, object>) => ({
  type: 'object',
  required: Object.keys(properties),
  properties,
});
const data = (schema: object) => object({ data: schema });
const json = (schema: object, description = 'Success') => ({
  description,
  content: { 'application/json': { schema } },
});
const errors = Object.fromEntries(
  [400, 401, 403, 404, 409, 413, 422, 500].map((status) => [
    status,
    json(
      ref('Error'),
      (
        {
          401: 'Sign in again',
          403: 'Insufficient role or Origin denied',
          404: 'Record not found',
          409: 'SAME_ROOM, EQUIPMENT_UNAVAILABLE, RELATED_RECORDS or CONCURRENT_CHANGE',
          422: 'VALIDATION_ERROR or EXPORT_TOO_LARGE',
        } as Record<number, string>
      )[status] ?? 'Request failed',
    ),
  ]),
);
const parameter = (name: string, schema: object) => ({ name, in: 'query', schema });
const paging = [
  parameter('page', { type: 'integer', minimum: 1, maximum: 100000, default: 1 }),
  parameter('pageSize', { type: 'integer', minimum: 1, maximum: 100, default: 20 }),
  parameter('search', { ...text, maxLength: 200 }),
  parameter('order', { type: 'string', enum: ['asc', 'desc'], default: 'desc' }),
];
const range = ['from', 'to'].map((name) =>
  parameter(name, {
    ...date,
    description: 'Inclusive UTC boundary; from must be <= to. ISO 8601 with timezone.',
  }),
);
const list = (schema: object) =>
  object({
    data: { type: 'array', items: schema },
    total: count,
    page: { type: 'integer', minimum: 1 },
    pageSize: { type: 'integer', minimum: 1, maximum: 100 },
  });
const security = [{ bearerAuth: [] }];
const movement = object({
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
});
const audit = object({
  id,
  actorId: id,
  actor: person,
  action: text,
  entityType: { ...text, nullable: true },
  entityId: { ...id, nullable: true },
  details: { type: 'object', nullable: true, additionalProperties: true },
  createdAt: date,
});
const dashboard = object({
  generatedAt: date,
  scope: { type: 'string', enum: ['own', 'all'] },
  totalEquipment: count,
  equipmentByStatus: object({
    available: count,
    issued: count,
    repair: count,
    written_off: count,
  }),
  activeLoans: count,
  overdueLoans: count,
  pendingRequests: count,
  loansByDay: {
    type: 'array',
    minItems: 7,
    maxItems: 7,
    items: object({ date: { type: 'string', format: 'date' }, count }),
  },
});

export const reportingSchemas = {
  Movement: movement,
  AuditEntry: audit,
  Dashboard: dashboard,
};
export const reportingPaths = {
  '/dashboard': {
    get: {
      summary: 'Dashboard counters and seven-day issuance chart',
      tags: ['Reports'],
      security,
      description:
        'All authenticated roles. Global equipment counters match the readable catalog. Teachers receive only their own loan/request counters and daily chart; staff see all. overdueLoans is a subset of activeLoans. loansByDay always includes seven UTC dates through today, including zero days. No query parameters.',
      responses: { 200: json(data(ref('Dashboard'))), ...errors },
    },
  },
  '/audit': {
    get: {
      summary: 'Global audit trail; admin only',
      tags: ['Reports'],
      security,
      description:
        'Immutable audit of account and domain actions. Search matches action or actor name. Exact filters are ANDed. Stable order uses id as tie-breaker. No passwords, tokens or file bytes are returned.',
      parameters: [
        ...paging,
        ...range,
        ...['actorId', 'entityId'].map((name) => parameter(name, id)),
        parameter('entityType', { ...text, minLength: 1, maxLength: 50 }),
        parameter('action', { ...text, minLength: 1, maxLength: 100 }),
        parameter('sort', {
          type: 'string',
          enum: ['createdAt', 'action'],
          default: 'createdAt',
        }),
      ],
      responses: { 200: json(list(ref('AuditEntry'))), ...errors },
    },
  },
  '/movements': {
    get: {
      summary: 'Movement history; technician or admin',
      tags: ['Movements'],
      security,
      description:
        'Includes moves recorded by PATCH /equipment/{id} and POST /movements. Search by reason, equipment name or inventory number; related names included. History cannot be edited or deleted.',
      parameters: [
        ...paging,
        ...range,
        ...['equipmentId', 'fromRoomId', 'toRoomId', 'actorId'].map((name) =>
          parameter(name, id),
        ),
        parameter('sort', { type: 'string', enum: ['createdAt'], default: 'createdAt' }),
      ],
      responses: { 200: json(list(ref('Movement'))), ...errors },
    },
    post: {
      summary: 'Move equipment atomically; technician or admin',
      tags: ['Movements'],
      security,
      description:
        'Origin must match CLIENT_ORIGIN. Updates room and records movement/audit in one serializable transaction. Issued equipment cannot move before return. Supply expectedFromRoomId to reject a stale card with 409 CONCURRENT_CHANGE. Same room gives 409 SAME_ROOM; missing equipment/room gives 404.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['equipmentId', 'toRoomId', 'reason'],
              properties: {
                equipmentId: id,
                toRoomId: id,
                expectedFromRoomId: id,
                reason: { ...text, minLength: 1, maxLength: 1000 },
              },
            },
            example: {
              equipmentId: '00000000-0000-4000-8000-000000000101',
              toRoomId: '00000000-0000-4000-8000-000000000201',
              reason: 'Перенос в учебную аудиторию',
            },
          },
        },
      },
      responses: { 201: json(data(ref('Movement'))), ...errors },
    },
  },
  '/equipment/export': {
    get: {
      summary: 'Export filtered equipment to XLSX; technician or admin',
      tags: ['Reports'],
      security,
      description:
        'Same search, status/category/room filters and stable sort as equipment list. Exports all matching rows, independent of pagination. page/pageSize are rejected. Maximum 5000 rows; larger sets return 422 EXPORT_TOO_LARGE with no truncated file. User values are typed as string cells, never formulas. Export records filters and row count in audit. Filename equipment-YYYY-MM-DD.xlsx, UTC date. Empty results produce a workbook with headers.',
      parameters: [
        parameter('search', { ...text, maxLength: 200 }),
        parameter('categoryId', id),
        parameter('roomId', id),
        parameter('status', {
          type: 'string',
          enum: ['available', 'issued', 'repair', 'written_off'],
        }),
        parameter('sort', {
          type: 'string',
          enum: ['name', 'inventoryNumber', 'status', 'createdAt', 'updatedAt'],
          default: 'name',
        }),
        parameter('order', { type: 'string', enum: ['asc', 'desc'], default: 'asc' }),
      ],
      responses: {
        200: {
          description: 'XLSX workbook with one equipment sheet',
          headers: {
            'Content-Disposition': {
              schema: text,
              example: 'attachment; filename="equipment-2026-10-21.xlsx"',
            },
          },
          content: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
              schema: { type: 'string', format: 'binary' },
            },
          },
        },
        ...errors,
      },
    },
  },
};
