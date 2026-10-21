const text = (maxLength = 100) => ({ type: 'string', minLength: 1, maxLength });
const id = { type: 'string', format: 'uuid' };
const statuses = ['available', 'issued', 'repair', 'written_off'];
const category = {
  type: 'object',
  required: ['id', 'name'],
  properties: { id, name: text() },
};
const room = {
  type: 'object',
  required: ['id', 'number', 'name', 'building', 'floor'],
  properties: {
    id,
    number: text(30),
    name: text(),
    building: text(),
    floor: { type: 'integer', minimum: -5, maximum: 100 },
  },
};
const equipment = {
  type: 'object',
  required: [
    'id',
    'name',
    'inventoryNumber',
    'serialNumber',
    'description',
    'status',
    'categoryId',
    'roomId',
    'attachmentId',
    'createdAt',
    'updatedAt',
    'category',
    'room',
  ],
  properties: {
    id,
    name: text(200),
    inventoryNumber: {
      ...text(80),
      description: 'Trimmed and normalized to uppercase before storage; unique in PostgreSQL',
    },
    serialNumber: { type: 'string', maxLength: 100, nullable: true },
    description: { type: 'string', maxLength: 5000 },
    status: { type: 'string', enum: statuses },
    categoryId: id,
    roomId: id,
    attachmentId: {
      type: 'string',
      format: 'uuid',
      nullable: true,
      deprecated: true,
      description:
        'Legacy nullable field, always null. Use /equipment/{equipmentId}/files for attachments.',
    },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    category,
    room,
  },
};
const writableEquipment = {
  ...equipment.properties,
  status: {
    type: 'string',
    enum: ['available', 'repair', 'written_off'],
    default: 'available',
  },
};
const equipmentBody = {
  name: writableEquipment.name,
  inventoryNumber: writableEquipment.inventoryNumber,
  serialNumber: writableEquipment.serialNumber,
  description: writableEquipment.description,
  status: writableEquipment.status,
  categoryId: id,
  roomId: id,
};
const roomBody = {
  number: text(30),
  name: text(),
  building: text(),
  floor: { type: 'integer', minimum: -5, maximum: 100 },
};
const categoryBody = { name: text() };
const body = (properties: object, required?: string[]) => ({
  type: 'object',
  additionalProperties: false,
  properties,
  ...(required ? { required } : { minProperties: 1 }),
});
const data = (schema: object) => ({
  type: 'object',
  required: ['data'],
  properties: { data: schema },
});
const json = (schema: object) => ({ 'application/json': { schema } });
const response = (schema: object) => ({ description: 'Success', content: json(schema) });
const errors = Object.fromEntries(
  [400, 401, 403, 404, 409, 413, 422, 500].map((code) => [
    code,
    {
      description:
        '422 VALIDATION_ERROR for invalid fields; 409 INVENTORY_NUMBER_EXISTS/ALREADY_EXISTS/RELATED_RECORDS/EQUIPMENT_ISSUED/CONCURRENT_CHANGE; 404 NOT_FOUND',
      content: json({ $ref: '#/components/schemas/Error' }),
    },
  ]),
);
const parameter = (name: string, schema: object) => ({ name, in: 'query', schema });
const paging = [
  parameter('page', { type: 'integer', minimum: 1, maximum: 100000, default: 1 }),
  parameter('pageSize', { type: 'integer', minimum: 1, maximum: 100, default: 20 }),
  parameter('search', {
    type: 'string',
    maxLength: 200,
    description: 'Case-insensitive substring',
  }),
  parameter('order', { type: 'string', enum: ['asc', 'desc'], default: 'asc' }),
];
const listResponse = (schema: object) =>
  response({
    type: 'object',
    required: ['data', 'total', 'page', 'pageSize'],
    properties: {
      data: { type: 'array', items: schema },
      total: { type: 'integer', minimum: 0 },
      page: { type: 'integer', minimum: 1 },
      pageSize: { type: 'integer', minimum: 1, maximum: 100 },
    },
  });
const security = [{ bearerAuth: [] }];

export const catalogSchemas = { Equipment: equipment, Category: category, Room: room };
export const catalogPaths: Record<string, object> = {};
for (const entry of [
  {
    route: 'equipment',
    schema: equipment,
    input: equipmentBody,
    required: ['name', 'inventoryNumber', 'categoryId', 'roomId'],
    sorts: ['name', 'inventoryNumber', 'status', 'createdAt', 'updatedAt'],
    filters: [
      parameter('categoryId', id),
      parameter('roomId', id),
      parameter('status', { type: 'string', enum: statuses }),
    ],
  },
  {
    route: 'categories',
    schema: category,
    input: categoryBody,
    required: ['name'],
    sorts: ['name'],
    filters: [],
  },
  {
    route: 'rooms',
    schema: room,
    input: roomBody,
    required: ['number', 'name', 'building', 'floor'],
    sorts: ['number', 'name', 'building', 'floor'],
    filters: [
      parameter('building', text()),
      parameter('floor', { type: 'integer', minimum: -5, maximum: 100 }),
    ],
  },
]) {
  const readDescription =
    'Requires an active account with teacher, technician or admin role. Lists use server-side filtering and a stable id tie-breaker; total is counted after filtering.';
  const writeDescription =
    'Requires technician or admin and Origin matching CLIENT_ORIGIN. Additional body fields are rejected. Equipment room changes create movement history atomically. Issued status cannot be set directly. Records referenced by equipment or movement history cannot be deleted.';
  catalogPaths[`/${entry.route}`] = {
    get: {
      summary: `List ${entry.route}`,
      tags: ['Catalog'],
      security,
      description: readDescription,
      parameters: [
        ...paging,
        parameter('sort', { type: 'string', enum: entry.sorts, default: entry.sorts[0] }),
        ...entry.filters,
      ],
      responses: { 200: listResponse(entry.schema), ...errors },
    },
    post: {
      summary: `Create ${entry.route}`,
      tags: ['Catalog'],
      security,
      description: writeDescription,
      requestBody: { required: true, content: json(body(entry.input, entry.required)) },
      responses: { 201: response(data(entry.schema)), ...errors },
    },
  };
  catalogPaths[`/${entry.route}/{id}`] = {
    parameters: [{ name: 'id', in: 'path', required: true, schema: id }],
    get: {
      summary: `Read ${entry.route} by id`,
      tags: ['Catalog'],
      security,
      description: readDescription,
      responses: { 200: response(data(entry.schema)), ...errors },
    },
    patch: {
      summary: `Update ${entry.route}`,
      tags: ['Catalog'],
      security,
      description: writeDescription,
      requestBody: { required: true, content: json(body(entry.input)) },
      responses: { 200: response(data(entry.schema)), ...errors },
    },
    delete: {
      summary: `Delete unreferenced ${entry.route}`,
      tags: ['Catalog'],
      security,
      description: writeDescription,
      responses: { 204: { description: 'Deleted; no response body' }, ...errors },
    },
  };
}
