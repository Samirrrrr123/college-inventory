export const reportPaths = {
  '/equipment/export': {
    get: {
      tags: ['Reports'],
      summary: 'Export filtered equipment as XLSX',
      description:
        'Technician/admin only. Exports every matching item in catalog order, without pagination. Uses the same search and filters as GET /equipment. At most 5000 items; larger results return 422 EXPORT_LIMIT without a partial file. User input is written as text, never as formulas. An empty result produces a workbook with column headers.',
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: 'search', in: 'query', schema: { type: 'string', maxLength: 200 } },
        ...['roomId', 'categoryId'].map((name) => ({
          name,
          in: 'query',
          schema: { type: 'string', format: 'uuid' },
        })),
        {
          name: 'status',
          in: 'query',
          schema: { type: 'string', enum: ['available', 'issued', 'repair', 'written_off'] },
        },
        {
          name: 'sort',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['name', 'inventoryNumber', 'status', 'createdAt', 'updatedAt'],
            default: 'name',
          },
        },
        {
          name: 'order',
          in: 'query',
          schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
        },
        {
          name: 'language',
          in: 'query',
          schema: { type: 'string', enum: ['ru', 'en'], default: 'ru' },
        },
      ],
      responses: {
        200: {
          description: 'equipment.xlsx',
          headers: {
            'Content-Disposition': {
              schema: { type: 'string' },
              description: 'attachment; filename="equipment.xlsx"',
            },
          },
          content: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
              schema: { type: 'string', format: 'binary' },
            },
          },
        },
        ...Object.fromEntries(
          [401, 403, 422, 500].map((status) => [
            status,
            {
              description: 'Request failed',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/Error' } },
              },
            },
          ]),
        ),
      },
    },
  },
};
