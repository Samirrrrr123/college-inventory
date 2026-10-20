export type Language = 'ru' | 'en';
export type Theme = 'light' | 'dark' | 'system';
export type Role = 'ADMIN' | 'LAB_ASSISTANT' | 'TEACHER';
export type EquipmentStatus = 'AVAILABLE' | 'ISSUED' | 'MAINTENANCE' | 'WRITTEN_OFF';
export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type LocalizedText = { ru: string; en: string };

export interface Person {
  id: string;
  name: string;
  email: string;
  role: Role;
  blocked: boolean;
}

export interface Room {
  id: string;
  number: string;
  title: LocalizedText;
  location: LocalizedText;
}

export interface Category {
  id: string;
  title: LocalizedText;
}

export interface Equipment {
  id: string;
  name: string;
  inventoryNumber: string;
  serialNumber: string;
  categoryId: string;
  roomId: string;
  status: EquipmentStatus;
  attachmentName?: string;
}

export type EquipmentInput = Omit<Equipment, 'id'>;

export interface EquipmentRequest {
  id: string;
  number: string;
  equipmentIds: string[];
  personId: string;
  purpose: string;
  createdAt: string;
  status: RequestStatus;
}

export interface Loan {
  id: string;
  number: string;
  equipmentIds: string[];
  personId: string;
  requestId: string | null;
  issuedAt: string;
  dueDate: string;
  returnedAt: string | null;
}

export interface Movement {
  id: string;
  equipmentId: string;
  fromRoomId: string;
  toRoomId: string;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  actorId: string;
  actor: string;
  action:
    | 'created'
    | 'updated'
    | 'deleted'
    | 'issued'
    | 'returned'
    | 'requestApproved'
    | 'requestRejected';
  subject: string;
  createdAt: string;
}
