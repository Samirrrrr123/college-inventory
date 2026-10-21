import { z } from 'zod';

export const id = z.uuid().transform((value) => value.toLowerCase());
export const createInput = z.object({ roomId: id }).strict();
export const itemInput = z.object({ found: z.boolean() }).strict();
export const emptyInput = z.object({}).strict();
const paging = {
  search: z.string().trim().max(200).default(''),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  order: z.enum(['asc', 'desc']).default('desc'),
};
export const checkQuery = z
  .object({
    ...paging,
    roomId: id.optional(),
    status: z.enum(['active', 'completed']).optional(),
    sort: z.enum(['number', 'createdAt']).default('createdAt'),
  })
  .strict();
export const itemQuery = z
  .object({
    ...paging,
    state: z.enum(['pending', 'found', 'missing']).optional(),
    sort: z.enum(['equipmentName', 'inventoryNumber']).default('inventoryNumber'),
  })
  .strict();
export type CheckQuery = z.infer<typeof checkQuery>;
export type ItemQuery = z.infer<typeof itemQuery>;
export type Actor = { id: string; role: string };
