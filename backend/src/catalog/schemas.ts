import { z } from 'zod';

export const identifier = z.uuid();
const shortName = z.string().trim().min(1).max(100);
export const status = z.enum(['available', 'issued', 'repair', 'written_off']);
const editableStatus = z.enum(['available', 'repair', 'written_off']);
export const categoryInput = z.object({ name: shortName }).strict();
export const roomInput = z
  .object({
    number: z.string().trim().min(1).max(30),
    name: shortName,
    building: shortName,
    floor: z.number().int().min(-5).max(100),
  })
  .strict();
const equipmentFields = {
  name: z.string().trim().min(1).max(200),
  inventoryNumber: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .transform((value) => value.toUpperCase())
    .pipe(z.string().max(80)),
  serialNumber: z.string().trim().max(100).nullable(),
  description: z.string().trim().max(5000),
  categoryId: identifier,
  roomId: identifier,
  status: editableStatus,
};
export const equipmentInput = z
  .object({
    ...equipmentFields,
    serialNumber: equipmentFields.serialNumber.default(null),
    description: equipmentFields.description.default(''),
    status: editableStatus.default('available'),
  })
  .strict();
const notEmpty = (input: object) => Object.keys(input).length > 0;
export const equipmentPatch = z
  .object(equipmentFields)
  .strict()
  .partial()
  .refine(notEmpty, 'Provide at least one field');
export const roomPatch = roomInput.partial().refine(notEmpty, 'Provide at least one field');
export const categoryPatch = categoryInput
  .partial()
  .refine(notEmpty, 'Provide at least one field');
const paging = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).default(''),
  order: z.enum(['asc', 'desc']).default('asc'),
});
export const equipmentQuery = paging
  .extend({
    sort: z
      .enum(['name', 'inventoryNumber', 'status', 'createdAt', 'updatedAt'])
      .default('name'),
    categoryId: identifier.optional(),
    roomId: identifier.optional(),
    status: status.optional(),
  })
  .strict();
export const roomQuery = paging
  .extend({
    sort: z.enum(['number', 'name', 'building', 'floor']).default('number'),
    building: shortName.optional(),
    floor: z.coerce.number().int().min(-5).max(100).optional(),
  })
  .strict();
export const categoryQuery = paging
  .extend({ sort: z.enum(['name']).default('name') })
  .strict();
export type EquipmentInput = z.infer<typeof equipmentInput>;
export type EquipmentPatch = z.infer<typeof equipmentPatch>;
export type RoomInput = z.infer<typeof roomInput>;
export type RoomPatch = z.infer<typeof roomPatch>;
export type CategoryInput = z.infer<typeof categoryInput>;
export type EquipmentQuery = z.infer<typeof equipmentQuery>;
export type RoomQuery = z.infer<typeof roomQuery>;
export type CategoryQuery = z.infer<typeof categoryQuery>;
