const object = (properties: Record<string, object>) => ({
  type: 'object',
  required: Object.keys(properties),
  properties,
});
const id = { type: 'string', format: 'uuid' };
const text = { type: 'string' };
const date = { type: 'string', format: 'date-time' };
const count = { type: 'integer', minimum: 0 };
const person = object({ id, name: text });
const items = {
  type: 'array',
  items: object({ equipment: object({ id, name: text, inventoryNumber: text }) }),
};
export const dashboardPaths = {
  '/dashboard': {
    get: {
      tags: ['Dashboard'],
      summary: 'Current inventory and circulation summary',
      description:
        'Teachers see only their own requests and loans. Staff see all. Equipment and room counts cover the college for all roles. Lists contain at most three entries. Overdue means unreturned and dueAt strictly before generatedAt. All values are read in one RepeatableRead transaction. Query parameters do not change the account scope.',
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Success',
          content: {
            'application/json': {
              schema: object({
                data: object({
                  generatedAt: date,
                  scope: { type: 'string', enum: ['own', 'all'] },
                  totalEquipment: count,
                  equipment: object({
                    available: count,
                    issued: count,
                    repair: count,
                    written_off: count,
                  }),
                  rooms: count,
                  activeLoans: count,
                  overdueLoans: count,
                  pendingRequests: count,
                  latestRequests: {
                    type: 'array',
                    maxItems: 3,
                    items: object({
                      id,
                      number: count,
                      status: {
                        type: 'string',
                        enum: ['pending', 'approved', 'rejected', 'cancelled'],
                      },
                      createdAt: date,
                      requester: person,
                      items,
                    }),
                  },
                  overdue: {
                    type: 'array',
                    maxItems: 3,
                    items: object({
                      id,
                      number: count,
                      dueAt: date,
                      recipient: person,
                      items,
                    }),
                  },
                }),
              }),
            },
          },
        },
        ...Object.fromEntries(
          [401, 403, 500].map((status) => [
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
