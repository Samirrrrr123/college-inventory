import { Prisma } from '@prisma/client';
import { ApiError } from '../errors.js';
import { CatalogRepository } from './repository.js';
import type {
  CategoryInput,
  CategoryQuery,
  EquipmentInput,
  EquipmentPatch,
  EquipmentQuery,
  RoomInput,
  RoomPatch,
  RoomQuery,
} from './schemas.js';

type Entity = 'equipment' | 'category' | 'room';

export class CatalogService {
  constructor(readonly repository: CatalogRepository) {}

  async equipment(query: EquipmentQuery) {
    const [data, total] = await this.repository.listEquipment(query);
    return {
      data: data.map((item) => ({ ...item, attachmentId: null })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async equipmentById(id: string) {
    const item = await this.repository.findEquipment(id);
    if (!item) throw new ApiError(404, 'NOT_FOUND', 'Equipment not found');
    return { ...item, attachmentId: null };
  }

  createEquipment(input: EquipmentInput, actorId: string) {
    return this.mutate('equipment', async () => ({
      ...(await this.repository.createEquipment(input, actorId)),
      attachmentId: null,
    }));
  }

  updateEquipment(id: string, input: EquipmentPatch, actorId: string) {
    return this.mutate('equipment', async () => ({
      ...(await this.repository.updateEquipment(id, input, actorId, (current) => {
        if (
          current.status === 'issued' &&
          (input.status !== undefined ||
            (input.roomId !== undefined && input.roomId !== current.roomId))
        ) {
          throw new ApiError(
            409,
            'EQUIPMENT_ISSUED',
            'Return the equipment before changing its status or room',
          );
        }
      })),
      attachmentId: null,
    }));
  }

  deleteEquipment(id: string, actorId: string) {
    return this.mutate('equipment', () =>
      this.repository.deleteEquipment(id, actorId, (current) => {
        if (current.status === 'issued')
          throw new ApiError(409, 'EQUIPMENT_ISSUED', 'Issued equipment cannot be deleted');
      }),
    );
  }

  async categories(query: CategoryQuery) {
    const [data, total] = await this.repository.listCategories(query);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async categoryById(id: string) {
    const item = await this.repository.findCategory(id);
    if (!item) throw new ApiError(404, 'NOT_FOUND', 'Category not found');
    return item;
  }

  createCategory(input: CategoryInput, actorId: string) {
    return this.mutate('category', () => this.repository.saveCategory(input, actorId));
  }
  updateCategory(id: string, input: Partial<CategoryInput>, actorId: string) {
    return this.mutate('category', () => this.repository.saveCategory(input, actorId, id));
  }
  deleteCategory(id: string, actorId: string) {
    return this.mutate('category', () => this.repository.deleteCategory(id, actorId));
  }

  async rooms(query: RoomQuery) {
    const [data, total] = await this.repository.listRooms(query);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async roomById(id: string) {
    const item = await this.repository.findRoom(id);
    if (!item) throw new ApiError(404, 'NOT_FOUND', 'Room not found');
    return item;
  }

  createRoom(input: RoomInput, actorId: string) {
    return this.mutate('room', () => this.repository.saveRoom(input, actorId));
  }
  updateRoom(id: string, input: RoomPatch, actorId: string) {
    return this.mutate('room', () => this.repository.saveRoom(input, actorId, id));
  }
  deleteRoom(id: string, actorId: string) {
    return this.mutate('room', () => this.repository.deleteRoom(id, actorId));
  }

  private async mutate<T>(entity: Entity, operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError)) throw error;
      if (error.code === 'P2025') throw new ApiError(404, 'NOT_FOUND', 'Resource not found');
      if (error.code === 'P2002') {
        const field =
          entity === 'equipment'
            ? 'inventoryNumber'
            : entity === 'category'
              ? 'name'
              : 'number';
        throw new ApiError(
          409,
          entity === 'equipment' ? 'INVENTORY_NUMBER_EXISTS' : 'ALREADY_EXISTS',
          'This value is already in use',
          { [field]: 'Already in use' },
        );
      }
      if (error.code === 'P2003')
        throw new ApiError(409, 'RELATED_RECORDS', 'Related records prevent this operation');
      throw error;
    }
  }
}
