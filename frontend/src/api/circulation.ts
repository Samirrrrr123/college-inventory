import type { EquipmentRecord } from './catalog';

export type SelectedEquipment = Pick<EquipmentRecord, 'id' | 'name' | 'inventoryNumber' | 'status'>;
export interface Recipient {
  id: string;
  name: string;
  email: string;
}
export interface RequestRecord {
  id: string;
  number: number;
  requesterId: string;
  requester: Recipient;
  purpose: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  decisionNote: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewer: Recipient | null;
  items: { equipmentId: string; equipment: SelectedEquipment }[];
  loan: { id: string; number: number; returnedAt: string | null } | null;
}
export interface LoanRecord {
  id: string;
  number: number;
  requestId: string | null;
  recipientId: string;
  recipient: Recipient;
  issuedBy: Recipient;
  returnedBy: Recipient | null;
  issuedAt: string;
  dueAt: string;
  returnedAt: string | null;
  items: { equipmentId: string; equipment: SelectedEquipment }[];
}
