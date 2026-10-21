import { z } from 'zod';
import { equipmentQuery } from '../catalog/schemas.js';

const identifier = z.uuid().transform((value) => value.toLowerCase());
const range = {
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
};
const paging = {
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).default(''),
  order: z.enum(['asc', 'desc']).default('desc'),
};
const validRange = (value: { from?: string; to?: string }) =>
  !value.from || !value.to || Date.parse(value.from) <= Date.parse(value.to);
export const auditQuery = z
  .object({
    ...paging,
    ...range,
    actorId: identifier.optional(),
    entityId: identifier.optional(),
    entityType: z.string().trim().min(1).max(50).optional(),
    action: z.string().trim().min(1).max(100).optional(),
    sort: z.enum(['createdAt', 'action']).default('createdAt'),
  })
  .strict()
  .refine(validRange, 'from must not follow to');
export const movementQuery = z
  .object({
    ...paging,
    ...range,
    equipmentId: identifier.optional(),
    fromRoomId: identifier.optional(),
    toRoomId: identifier.optional(),
    actorId: identifier.optional(),
    sort: z.enum(['createdAt']).default('createdAt'),
  })
  .strict()
  .refine(validRange, 'from must not follow to');
export const movementInput = z
  .object({
    equipmentId: identifier,
    toRoomId: identifier,
    expectedFromRoomId: identifier.optional(),
    reason: z.string().trim().min(1).max(1000),
  })
  .strict();
export const exportQuery = equipmentQuery.omit({ page: true, pageSize: true });
export const dashboardQuery = z.object({}).strict();
export type AuditQuery = z.infer<typeof auditQuery>;
export type MovementQuery = z.infer<typeof movementQuery>;
export type MovementInput = z.infer<typeof movementInput>;
export type ExportQuery = z.infer<typeof exportQuery>;
export type Actor = { id: string; role: string };
