const id = { type: 'string', format: 'uuid' };
const date = { type: 'string', format: 'date-time' };
const text = { type: 'string' };
const person = {
  type: 'object',
  required: ['id', 'name', 'email'],
  properties: { id, name: text, email: { ...text, format: 'email' } },
};
const equipment = {
  type: 'object',
  required: ['id', 'name', 'inventoryNumber', 'status'],
  properties: {
    id,
    name: text,
    inventoryNumber: text,
    status: { ...text, enum: ['available', 'issued', 'repair', 'written_off'] },
  },
};
const items = {
  type: 'array',
  items: {
    type: 'object',
    properties: { equipmentId: id, equipment },
    required: ['equipmentId', 'equipment'],
  },
};
const request = {
  type: 'object',
  required: [
    'id',
    'number',
    'requesterId',
    'purpose',
    'status',
    'items',
    'requester',
    'createdAt',
    'loan',
    'decisionNote',
    'reviewerId',
    'reviewer',
    'reviewedAt',
  ],
  properties: {
    id,
    number: { type: 'integer' },
    requesterId: id,
    requester: person,
    purpose: text,
    status: { ...text, enum: ['pending', 'approved', 'rejected', 'cancelled'] },
    items,
    createdAt: date,
    decisionNote: text,
    reviewerId: { ...id, nullable: true },
    reviewedAt: { ...date, nullable: true },
    reviewer: { ...person, nullable: true },
    loan: {
      type: 'object',
      nullable: true,
      required: ['id', 'number', 'returnedAt'],
      properties: { id, number: { type: 'integer' }, returnedAt: { ...date, nullable: true } },
    },
  },
};
const loan = {
  type: 'object',
  required: [
    'id',
    'number',
    'recipientId',
    'recipient',
    'issuedById',
    'issuedBy',
    'returnedById',
    'returnedBy',
    'issuedAt',
    'dueAt',
    'returnedAt',
    'requestId',
    'items',
  ],
  properties: {
    id,
    number: { type: 'integer' },
    requestId: { ...id, nullable: true },
    recipientId: id,
    recipient: person,
    issuedById: id,
    issuedBy: person,
    returnedById: { ...id, nullable: true },
    returnedBy: { ...person, nullable: true },
    issuedAt: date,
    dueAt: date,
    returnedAt: { ...date, nullable: true },
    items,
  },
};
const equipmentIds = {
  type: 'array',
  minItems: 1,
  maxItems: 20,
  uniqueItems: true,
  items: id,
};
const errors = Object.fromEntries(
  [400, 401, 403, 404, 409, 422, 500].map((status) => [
    status,
    {
      description: 'Request failed',
      content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
    },
  ]),
);
const response = (schema: object) => ({
  description: 'Success',
  content: { 'application/json': { schema } },
});
const single = (schema: object) => ({
  type: 'object',
  required: ['data'],
  properties: { data: schema },
});
const body = (schema: object) => ({
  required: true,
  content: { 'application/json': { schema } },
});
const identifier = { in: 'path', name: 'id', required: true, schema: id };
const parameters = [
  { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
  {
    in: 'query',
    name: 'pageSize',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
  { in: 'query', name: 'search', schema: { ...text, maxLength: 200 } },
];
const list = (schema: object, sort: string[], statuses: string[]) => ({
  summary: 'Server-side search, filters, sorting and paging',
  parameters: [
    ...parameters,
    { in: 'query', name: 'sort', schema: { ...text, enum: sort, default: sort[0] } },
    {
      in: 'query',
      name: 'order',
      schema: { ...text, enum: ['asc', 'desc'], default: 'desc' },
    },
    { in: 'query', name: 'status', schema: { ...text, enum: statuses } },
  ],
  responses: {
    200: response({
      type: 'object',
      required: ['data', 'total', 'page', 'pageSize'],
      properties: {
        data: { type: 'array', items: schema },
        total: { type: 'integer' },
        page: { type: 'integer' },
        pageSize: { type: 'integer' },
      },
    }),
    ...errors,
  },
});
const mutate = (
  summary: string,
  schema: object,
  result: object,
  status = 200,
  withId = true,
) => ({
  summary,
  description:
    'Requires the configured Origin header. Unknown body properties are rejected. Staff means technician or admin.',
  ...(withId ? { parameters: [identifier] } : {}),
  requestBody: body(schema),
  responses: { [status]: response(single(result)), ...errors },
});
const empty = { type: 'object', additionalProperties: false, properties: {} };
const decision = {
  type: 'object',
  additionalProperties: false,
  properties: { note: { ...text, maxLength: 500, default: '' } },
};
export const circulationSchemas = { EquipmentRequest: request, Loan: loan };
export const circulationPaths = {
  '/api/requests': {
    get: {
      ...list(
        request,
        ['createdAt', 'number'],
        ['pending', 'approved', 'rejected', 'cancelled'],
      ),
      description: 'Teachers receive only their own requests. Staff receive all requests.',
    },
    post: mutate(
      'Create own request without reserving equipment',
      {
        type: 'object',
        additionalProperties: false,
        required: ['equipmentIds', 'purpose'],
        properties: { equipmentIds, purpose: { ...text, minLength: 1, maxLength: 300 } },
      },
      request,
      201,
      false,
    ),
  },
  '/api/requests/{id}': {
    get: {
      summary: 'Read request; foreign teacher requests return 404',
      parameters: [identifier],
      responses: { 200: response(single(request)), ...errors },
    },
  },
  '/api/requests/{id}/approve': {
    post: mutate(
      'Staff: approve pending request without reserving equipment',
      decision,
      request,
    ),
  },
  '/api/requests/{id}/reject': {
    post: mutate('Staff: reject pending request', decision, request),
  },
  '/api/requests/{id}/cancel': {
    post: mutate(
      'Cancel own pending or approved request before issuing; staff may cancel any',
      empty,
      request,
    ),
  },
  '/api/loans': {
    get: {
      ...list(loan, ['issuedAt', 'number', 'dueAt'], ['active', 'returned', 'overdue']),
      description:
        'Teachers receive only their own loans. Overdue means dueAt is in the past and returnedAt is null.',
    },
    post: mutate(
      'Staff: issue an available equipment set atomically',
      {
        oneOf: [
          {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'requestId', 'dueAt'],
            properties: { kind: { ...text, enum: ['request'] }, requestId: id, dueAt: date },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: ['kind', 'recipientId', 'equipmentIds', 'dueAt'],
            properties: {
              kind: { ...text, enum: ['direct'] },
              recipientId: id,
              equipmentIds,
              dueAt: date,
            },
          },
        ],
      },
      loan,
      201,
      false,
    ),
  },
  '/api/loans/{id}': {
    get: {
      summary: 'Read loan; foreign teacher loans return 404',
      parameters: [identifier],
      responses: { 200: response(single(loan)), ...errors },
    },
  },
  '/api/loans/{id}/return': {
    post: mutate(
      'Staff: return the entire set atomically; repeated returns fail',
      empty,
      loan,
    ),
  },
  '/api/loan-recipients': {
    get: {
      summary: 'Staff: search active recipients without exposing password hashes',
      parameters,
      responses: {
        200: response({
          type: 'object',
          required: ['data', 'total', 'page', 'pageSize'],
          properties: {
            data: { type: 'array', items: person },
            total: { type: 'integer' },
            page: { type: 'integer' },
            pageSize: { type: 'integer' },
          },
        }),
        ...errors,
      },
    },
  },
};
