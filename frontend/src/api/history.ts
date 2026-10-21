import type { RoomRecord } from './catalog';
import type { MessageKey } from '../i18n/messages';

interface Person {
  id: string;
  name: string;
}
export interface MovementRecord {
  id: string;
  equipmentId: string;
  fromRoomId: string;
  toRoomId: string;
  actorId: string;
  reason: string;
  createdAt: string;
  equipment: { id: string; name: string; inventoryNumber: string };
  fromRoom: RoomRecord;
  toRoom: RoomRecord;
  actor: Person;
}
export interface AuditRecord {
  id: string;
  actorId: string;
  actor: Person;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown> | null;
  subject: string | null;
  createdAt: string;
}
export const historyActions: Record<string, MessageKey> = {
  registered: 'activityRegistered',
  signedIn: 'activitySignedIn',
  profileUpdated: 'activityProfileUpdated',
  passwordChanged: 'activityPasswordChanged',
  requestCreated: 'activityRequestCreated',
  requestApproved: 'requestApproved',
  requestRejected: 'requestRejected',
  requestCancelled: 'activityRequestCancelled',
  loanIssued: 'activityLoanIssued',
  loanReturned: 'activityLoanReturned',
  fileUploaded: 'fileUploaded',
  fileDeleted: 'fileDeleted',
  inventoryStarted: 'inventoryStarted',
  inventoryItemChecked: 'inventoryItemChecked',
  inventoryCompleted: 'inventoryCompleted',
  userAccessChanged: 'userAccessChanged',
  equipmentCreated: 'historyEquipmentCreated',
  equipmentUpdated: 'historyEquipmentUpdated',
  equipmentDeleted: 'historyEquipmentDeleted',
  categoryCreated: 'historyCategoryCreated',
  categoryUpdated: 'historyCategoryUpdated',
  categoryDeleted: 'historyCategoryDeleted',
  roomCreated: 'historyRoomCreated',
  roomUpdated: 'historyRoomUpdated',
  roomDeleted: 'historyRoomDeleted',
};
export const historyEntities: Record<string, MessageKey> = {
  account: 'historyAccount',
  equipment: 'equipment',
  room: 'rooms',
  category: 'categories',
  request: 'requests',
  loan: 'historyLoan',
  inventory: 'inventory',
  user: 'users',
};
export const historyRoom = (room: RoomRecord) => `${room.number} · ${room.name} · ${room.building}`;
