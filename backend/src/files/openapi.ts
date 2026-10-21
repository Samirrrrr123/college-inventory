const id = { type: 'string', format: 'uuid' };
const file = {
  type: 'object',
  required: ['id', 'equipmentId', 'uploadedById', 'name', 'contentType', 'size', 'createdAt'],
  properties: {
    id,
    equipmentId: id,
    uploadedById: id,
    name: { type: 'string', maxLength: 160 },
    contentType: { type: 'string', enum: ['image/png', 'image/jpeg', 'application/pdf'] },
    size: { type: 'integer', minimum: 1, maximum: 5242880 },
    createdAt: { type: 'string', format: 'date-time' },
  },
};
const json = (schema: object) => ({
  description: 'Success',
  content: { 'application/json': { schema } },
});
const errors = Object.fromEntries(
  [401, 403, 404, 413, 415, 422].map((status) => [
    status,
    {
      description: (
        {
          401: 'Login required',
          403: 'Role or origin denied',
          404: 'Equipment or file not found',
          413: 'File exceeds 5 MB',
          415: 'Extension, MIME type or signature is not allowed',
          422: 'Invalid name, empty file or query',
        } as Record<number, string>
      )[status],
      content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
    },
  ]),
);
const parameters = [{ name: 'equipmentId', in: 'path', required: true, schema: id }];
const security = [{ bearerAuth: [] }];
const root = '/equipment/{equipmentId}/files';
const binary = Object.fromEntries(
  ['image/png', 'image/jpeg', 'application/pdf'].map((type) => [
    type,
    { schema: { type: 'string', format: 'binary' } },
  ]),
);

export const filePaths = {
  [root]: {
    get: {
      summary: 'List equipment files for signed-in users',
      security,
      parameters: [
        ...parameters,
        ...[
          { name: 'search', schema: { type: 'string', maxLength: 200 } },
          { name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
          {
            name: 'pageSize',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
          {
            name: 'sort',
            schema: { type: 'string', enum: ['name', 'createdAt'], default: 'createdAt' },
          },
          {
            name: 'order',
            schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          },
        ].map((parameter) => ({ ...parameter, in: 'query' })),
      ],
      responses: {
        200: json({
          type: 'object',
          properties: {
            data: { type: 'array', items: file },
            total: { type: 'integer' },
            page: { type: 'integer' },
            pageSize: { type: 'integer' },
          },
        }),
        ...errors,
      },
    },
    post: {
      summary: 'Upload PNG, JPG or PDF; technician or admin',
      security,
      description:
        'Send the file as the request body, not JSON or multipart. X-File-Name contains the percent-encoded original name. Maximum 5 MB; extension, MIME and signature must agree. The server assigns the uploader. Bytes and metadata are stored in PostgreSQL with the audit record.',
      parameters: [
        ...parameters,
        {
          name: 'X-File-Name',
          in: 'header',
          required: true,
          schema: { type: 'string' },
          example: '%D1%84%D0%BE%D1%82%D0%BE.png',
        },
      ],
      requestBody: { required: true, content: binary },
      responses: { 201: json({ type: 'object', properties: { data: file } }), ...errors },
    },
  },
  [`${root}/{fileId}`]: {
    get: {
      summary: 'Download a file belonging to this equipment; signed-in users',
      security,
      parameters: [...parameters, { name: 'fileId', in: 'path', required: true, schema: id }],
      responses: {
        200: {
          description: 'Download with Content-Disposition: attachment; no public file URL',
          content: binary,
        },
        ...errors,
      },
    },
    delete: {
      summary: 'Delete equipment file; technician or admin',
      security,
      parameters: [...parameters, { name: 'fileId', in: 'path', required: true, schema: id }],
      responses: { 204: { description: 'Deleted; audit preserved' }, ...errors },
    },
  },
};
