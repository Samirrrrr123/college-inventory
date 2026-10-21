import { z } from 'zod';

export const id = z.uuid().transform((value) => value.toLowerCase());
export const role = z.enum(['teacher', 'technician', 'admin']);
const name = z.string().trim().min(2).max(100);
const email = z
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
export const userInput = z
  .object({
    name,
    email,
    password: z
      .string()
      .min(8)
      .max(72)
      .refine((value) => Buffer.byteLength(value) <= 72),
    role,
    isBlocked: z.boolean().default(false),
  })
  .strict();
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
  .object({
    name: name.optional(),
    email: email.optional(),
    role: role.optional(),
    isBlocked: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);
export type UserQuery = z.infer<typeof userQuery>;
export type UserPatch = z.infer<typeof userPatch>;
export type UserInput = z.infer<typeof userInput>;
export type Actor = { id: string; role: string };
