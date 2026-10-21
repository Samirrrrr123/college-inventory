const id = { type: 'string', format: 'uuid' };
const date = { type: 'string', format: 'date-time' };
const person = { type: 'object', properties: { id, name: { type: 'string' } } };
const check = {
  type: 'object',
  properties: {
    id,
    number: { type: 'integer' },
    roomId: id,
    createdById: id,
    completedById: { ...id, nullable: true },
    createdAt: date,
    completedAt: { ...date, nullable: true },
    room: {
      type: 'object',
      properties: {
        id,
        number: { type: 'string' },
        name: { type: 'string' },
        building: { type: 'string' },
      },
    },
    createdBy: person,
    completedBy: { ...person, nullable: true },
    _count: { type: 'object', properties: { items: { type: 'integer' } } },
  },
};
const item = {
  type: 'object',
  properties: {
    checkId: id,
    equipmentId: id,
    equipmentName: { type: 'string' },
    inventoryNumber: { type: 'string' },
    statusAtStart: { type: 'string', enum: ['available', 'issued', 'repair', 'written_off'] },
    found: { type: 'boolean', nullable: true },
    checkedAt: { ...date, nullable: true },
  },
};
const response = (schema: object) => ({
  description: 'Success',
  content: { 'application/json': { schema } },
});
const data = (schema: object) => response({ type: 'object', properties: { data: schema } });
const list = (schema: object) =>
  response({
    type: 'object',
    properties: {
      data: { type: 'array', items: schema },
      total: { type: 'integer' },
      page: { type: 'integer' },
      pageSize: { type: 'integer' },
    },
  });
const errors = Object.fromEntries(
  [401, 403, 404, 409, 422].map((status) => [
    status,
    {
      description: (
        {
          401: 'Login required',
          403: 'Technician or admin required',
          404: 'Check, room or item not found',
          409: 'CHECK_COMPLETED, CHECK_INCOMPLETE or CONCURRENT_CHANGE',
          422: 'Validation error or NO_EQUIPMENT',
        } as Record<number, string>
      )[status],
      content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
    },
  ]),
);
const security = [{ bearerAuth: [] }];
const parameters = [{ name: 'id', in: 'path', required: true, schema: id }];
const body = (schema: object) => ({
  required: true,
  content: { 'application/json': { schema } },
});
const paging = [
  { name: 'search', in: 'query', schema: { type: 'string', maxLength: 200 } },
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  {
    name: 'pageSize',
    in: 'query',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
  {
    name: 'order',
    in: 'query',
    schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
  },
];
const root = '/inventory-checks';

export const inventoryPaths = {
  [root]: {
    get: {
      summary: 'List inventory checks; staff only',
      security,
      parameters: [
        ...paging,
        { name: 'roomId', in: 'query', schema: id },
        {
          name: 'status',
          in: 'query',
          schema: { type: 'string', enum: ['active', 'completed'] },
        },
        {
          name: 'sort',
          in: 'query',
          schema: { type: 'string', enum: ['number', 'createdAt'], default: 'createdAt' },
        },
      ],
      responses: { 200: list(check), ...errors },
    },
    post: {
      summary: 'Start a room check; staff only',
      security,
      description:
        'The server copies the current equipment IDs, names, numbers and statuses into check items. Empty rooms are rejected. Results never change equipment status or location. The creator comes from the session.',
      requestBody: body({
        type: 'object',
        additionalProperties: false,
        required: ['roomId'],
        properties: { roomId: id },
      }),
      responses: { 201: data(check), ...errors },
    },
  },
  [`${root}/{id}`]: {
    get: {
      summary: 'Read a check and summary; staff only',
      security,
      parameters,
      responses: {
        200: data({
          ...check,
          properties: {
            ...check.properties,
            summary: {
              type: 'object',
              properties: Object.fromEntries(
                ['total', 'found', 'missing', 'pending'].map((key) => [
                  key,
                  { type: 'integer', minimum: 0 },
                ]),
              ),
            },
          },
        }),
        ...errors,
      },
    },
  },
  [`${root}/{id}/items`]: {
    get: {
      summary: 'List check items with server search, filters and paging',
      security,
      parameters: [
        ...parameters,
        ...paging,
        {
          name: 'state',
          in: 'query',
          schema: { type: 'string', enum: ['pending', 'found', 'missing'] },
        },
        {
          name: 'sort',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['equipmentName', 'inventoryNumber'],
            default: 'inventoryNumber',
          },
        },
      ],
      responses: { 200: list(item), ...errors },
    },
  },
  [`${root}/{id}/items/{equipmentId}`]: {
    patch: {
      summary: 'Mark presence while the check is active; staff only',
      security,
      parameters: [
        ...parameters,
        { name: 'equipmentId', in: 'path', required: true, schema: id },
      ],
      requestBody: body({
        type: 'object',
        additionalProperties: false,
        required: ['found'],
        properties: { found: { type: 'boolean' } },
      }),
      responses: { 200: data(item), ...errors },
    },
  },
  [`${root}/{id}/complete`]: {
    post: {
      summary: 'Complete a fully marked check; staff only',
      security,
      parameters,
      description:
        'Requires every item to be marked. Saves the completion time, staff member and audit in one transaction. Repeated completion and later item edits are rejected.',
      requestBody: body({ type: 'object', additionalProperties: false }),
      responses: { 200: data(check), ...errors },
    },
  },
};
