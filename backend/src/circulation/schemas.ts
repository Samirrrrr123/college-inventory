import { z } from 'zod';

export const id = z.uuid().transform((value) => value.toLowerCase());
const equipmentIds = z
  .array(id)
  .min(1)
  .max(20)
  .refine((ids) => new Set(ids).size === ids.length);
const paging = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).default(''),
  order: z.enum(['asc', 'desc']).default('desc'),
};
export const requestInput = z
  .object({ purpose: z.string().trim().min(1).max(300), equipmentIds })
  .strict();
export const decisionInput = z
  .object({ note: z.string().trim().max(500).default('') })
  .strict();
export const requestQuery = z
  .object({
    ...paging,
    status: z.enum(['pending', 'approved', 'rejected', 'cancelled']).optional(),
    sort: z.enum(['number', 'createdAt']).default('createdAt'),
  })
  .strict();
export const loanQuery = z
  .object({
    ...paging,
    status: z.enum(['active', 'returned', 'overdue']).optional(),
    sort: z.enum(['number', 'issuedAt', 'dueAt']).default('issuedAt'),
  })
  .strict();
export const loanInput = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('request'),
      requestId: id,
      dueAt: z.iso.datetime({ offset: true }),
    })
    .strict(),
  z
    .object({
      kind: z.literal('direct'),
      recipientId: id,
      equipmentIds,
      dueAt: z.iso.datetime({ offset: true }),
    })
    .strict(),
]);
export type RequestInput = z.infer<typeof requestInput>;
export type LoanInput = z.infer<typeof loanInput>;
export type RequestQuery = z.infer<typeof requestQuery>;
export type LoanQuery = z.infer<typeof loanQuery>;
export type Actor = { id: string; role: string };
export const recipientQuery = requestQuery.pick({ search: true, page: true, pageSize: true });
export type RecipientQuery = z.infer<typeof recipientQuery>;
