import { api } from './client';
import type { EquipmentStatus, Person } from '../domain/types';

export interface Account {
  id: string;
  name: string;
  email: string;
  role: 'teacher' | 'technician' | 'admin';
  isBlocked: boolean;
}
export interface CategoryRecord {
  id: string;
  name: string;
}
export interface RoomRecord {
  id: string;
  number: string;
  name: string;
  building: string;
  floor: number;
}
export interface EquipmentRecord {
  id: string;
  name: string;
  inventoryNumber: string;
  serialNumber: string | null;
  description: string;
  categoryId: string;
  roomId: string;
  status: 'available' | 'issued' | 'repair' | 'written_off';
  category: CategoryRecord;
  room: RoomRecord;
  attachmentId: null;
  createdAt: string;
  updatedAt: string;
}
export interface ListResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
export type RoomValues = Omit<RoomRecord, 'id'>;
export type EquipmentValues = Pick<
  EquipmentRecord,
  'name' | 'inventoryNumber' | 'serialNumber' | 'description' | 'categoryId' | 'roomId'
> & { status?: Exclude<EquipmentRecord['status'], 'issued'> };

export function queryString(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  return params.toString();
}

export async function loadReferences<T>(path: 'rooms' | 'categories'): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  while (true) {
    const result = await api<ListResult<T>>(`/${path}?page=${page}&pageSize=100`);
    items.push(...result.data);
    if (page * result.pageSize >= result.total || result.data.length === 0) return items;
    page += 1;
  }
}

export const statuses: Record<EquipmentRecord['status'], EquipmentStatus> = {
  available: 'AVAILABLE',
  issued: 'ISSUED',
  repair: 'MAINTENANCE',
  written_off: 'WRITTEN_OFF',
};

export function accountPerson(account: Account): Person {
  return {
    ...account,
    role:
      account.role === 'admin'
        ? 'ADMIN'
        : account.role === 'technician'
          ? 'LAB_ASSISTANT'
          : 'TEACHER',
    blocked: account.isBlocked,
  };
}
