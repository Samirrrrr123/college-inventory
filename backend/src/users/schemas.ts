import { z } from 'zod';

export const id = z.uuid().transform((value) => value.toLowerCase());
export const role = z.enum(['teacher', 'technician', 'admin']);
export const userQuery = z
  .object({
    search: z.string().trim().max(100).default(''),
    role: role.optional(),
    status: z.enum(['active', 'blocked']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sort: z.enum(['name', 'email']).default('name'),
    order: z.enum(['asc', 'desc']).default('asc'),
  })
  .strict();
export const userPatch = z
  .object({ role: role.optional(), isBlocked: z.boolean().optional() })
  .strict()
  .refine((value) => Object.keys(value).length > 0);
export type UserQuery = z.infer<typeof userQuery>;
export type UserPatch = z.infer<typeof userPatch>;
export type Actor = { id: string; role: string };
