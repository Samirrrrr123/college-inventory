import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { CatalogRepository } from '../src/catalog/repository.js';
import { CatalogService } from '../src/catalog/service.js';
import { equipmentInput, equipmentPatch, equipmentQuery } from '../src/catalog/schemas.js';

const actor = '00000000-0000-4000-8000-000000000001';
const equipment = {
  name: 'Laptop',
  inventoryNumber: 'INV-1',
  categoryId: actor,
  roomId: actor,
};
const known = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('Database details must stay private', {
    code,
    clientVersion: '6.19.3',
  });

describe('Catalog business rules', () => {
  it('does not reset omitted defaults during a partial edit', () => {
    expect(equipmentPatch.parse({ name: 'Updated' })).toEqual({ name: 'Updated' });
    expect(() => equipmentPatch.parse({})).toThrow();
    expect(() =>
      equipmentInput.parse({ ...equipment, inventoryNumber: 'ß'.repeat(41) }),
    ).toThrow();
    expect(equipmentInput.parse(equipment)).toMatchObject({
      serialNumber: null,
      description: '',
      status: 'available',
    });
    expect(equipmentInput.parse({ ...equipment, inventoryNumber: ' inv-1 ' })).toMatchObject({
      inventoryNumber: 'INV-1',
    });
  });

  it('rejects issued state from direct create and PATCH inputs', () => {
    expect(() => equipmentInput.parse({ ...equipment, status: 'issued' })).toThrow();
    expect(() => equipmentPatch.parse({ status: 'issued' })).toThrow();
  });

  it('validates bounded paging and whitelisted sort fields', () => {
    expect(equipmentQuery.parse({})).toMatchObject({
      page: 1,
      pageSize: 20,
      sort: 'name',
      order: 'asc',
    });
    expect(() => equipmentQuery.parse({ sort: 'passwordHash' })).toThrow();
    expect(() => equipmentQuery.parse({ pageSize: 1000 })).toThrow();
  });

  it.each(['status', 'room'])('rejects %s changes while a unit is issued', async (field) => {
    const updateEquipment = vi.fn(async (_id, _input, _actor, guard) => {
      guard({ status: 'issued', roomId: actor });
      return equipment;
    });
    const service = new CatalogService({ updateEquipment } as unknown as CatalogRepository);
    const patch =
      field === 'status'
        ? { status: 'repair' as const }
        : { roomId: '00000000-0000-4000-8000-000000000002' };
    await expect(service.updateEquipment(actor, patch, actor)).rejects.toMatchObject({
      status: 409,
      code: 'EQUIPMENT_ISSUED',
    });
  });

  it('allows a label edit for issued equipment but rejects its deletion', async () => {
    const updateEquipment = vi.fn(async (_id, _input, _actor, guard) => {
      guard({ status: 'issued', roomId: actor });
      return { ...equipment, id: actor, status: 'issued' };
    });
    const deleteEquipment = vi.fn(async (_id, _actor, guard) =>
      guard({ status: 'issued', roomId: actor }),
    );
    const service = new CatalogService({
      updateEquipment,
      deleteEquipment,
    } as unknown as CatalogRepository);
    expect(await service.updateEquipment(actor, { name: 'New label' }, actor)).toMatchObject({
      id: actor,
      attachmentId: null,
    });
    await expect(service.deleteEquipment(actor, actor)).rejects.toMatchObject({
      code: 'EQUIPMENT_ISSUED',
    });
  });

  it.each(['equipment', 'category', 'room'])(
    'maps %s uniqueness to a field-level conflict',
    async (entity) => {
      const repository = {
        createEquipment: vi.fn().mockRejectedValue(known('P2002')),
        saveCategory: vi.fn().mockRejectedValue(known('P2002')),
        saveRoom: vi.fn().mockRejectedValue(known('P2002')),
      } as unknown as CatalogRepository;
      const service = new CatalogService(repository);
      const operation =
        entity === 'equipment'
          ? service.createEquipment(equipmentInput.parse(equipment), actor)
          : entity === 'category'
            ? service.createCategory({ name: 'Name' }, actor)
            : service.createRoom(
                { name: 'Name', number: '1', building: 'A', floor: 1 },
                actor,
              );
      const field =
        entity === 'equipment' ? 'inventoryNumber' : entity === 'category' ? 'name' : 'number';
      await expect(operation).rejects.toMatchObject({
        status: 409,
        fields: { [field]: 'Already in use' },
      });
    },
  );

  it.each([
    ['P2025', 404, 'NOT_FOUND'],
    ['P2003', 409, 'RELATED_RECORDS'],
  ])('maps %s without exposing database details', async (code, status, errorCode) => {
    const repository = {
      deleteCategory: vi.fn().mockRejectedValue(known(String(code))),
    } as unknown as CatalogRepository;
    await expect(
      new CatalogService(repository).deleteCategory(actor, actor),
    ).rejects.toMatchObject({ status, code: errorCode });
  });

  it('does not disguise unknown database errors as validation errors', async () => {
    const error = known('P1001');
    const repository = {
      deleteCategory: vi.fn().mockRejectedValue(error),
    } as unknown as CatalogRepository;
    await expect(new CatalogService(repository).deleteCategory(actor, actor)).rejects.toBe(
      error,
    );
  });
});
