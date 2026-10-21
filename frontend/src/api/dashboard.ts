type EquipmentSummary = { id: string; name: string; inventoryNumber: string };
type PersonSummary = { id: string; name: string };
export interface Dashboard {
  generatedAt: string;
  scope: 'own' | 'all';
  totalEquipment: number;
  equipment: Record<'available' | 'issued' | 'repair' | 'written_off', number>;
  rooms: number;
  activeLoans: number;
  overdueLoans: number;
  pendingRequests: number;
  latestRequests: {
    id: string;
    number: number;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    createdAt: string;
    requester: PersonSummary;
    items: { equipment: EquipmentSummary }[];
  }[];
  overdue: {
    id: string;
    number: number;
    dueAt: string;
    recipient: PersonSummary;
    items: { equipment: EquipmentSummary }[];
  }[];
}
