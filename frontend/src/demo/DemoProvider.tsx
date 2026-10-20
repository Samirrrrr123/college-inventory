import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { AuditEntry, EquipmentInput, EquipmentRequest, RequestStatus } from '../domain/types';
import * as initial from './data';

function useDemoState() {
  const [equipment, setEquipment] = useState(initial.equipment);
  const [requests, setRequests] = useState(initial.requests);
  const [loans, setLoans] = useState(initial.loans);
  const [people, setPeople] = useState(initial.people);
  const [movements, setMovements] = useState(initial.movements);
  const [audit, setAudit] = useState(initial.audit);
  const [personId, setPersonId] = useState('samir');
  const [checks, setChecks] = useState<Record<string, { date: string; found: number }>>({});
  const person = people.find((item) => item.id === personId) ?? people[0];

  function record(action: AuditEntry['action'], subject: string) {
    setAudit((items) => [
      {
        id: crypto.randomUUID(),
        actor: person.name,
        action,
        subject,
        createdAt: new Date().toISOString(),
      },
      ...items,
    ]);
  }

  function saveEquipment(input: EquipmentInput, id?: string) {
    if (
      equipment.some(
        (item) =>
          item.id !== id &&
          item.inventoryNumber.toLowerCase() === input.inventoryNumber.toLowerCase(),
      )
    )
      return 'duplicate' as const;
    setEquipment((items) =>
      id
        ? items.map((item) => (item.id === id ? { ...input, id } : item))
        : [{ ...input, id: crypto.randomUUID() }, ...items],
    );
    record(id ? 'updated' : 'created', input.name);
    return 'saved' as const;
  }

  function deleteEquipment(id: string) {
    if (
      requests.some((item) => item.equipmentId === id) ||
      loans.some((item) => item.equipmentId === id)
    )
      return false;
    const item = equipment.find((item) => item.id === id);
    setEquipment((items) => items.filter((item) => item.id !== id));
    record('deleted', item?.name ?? id);
    return true;
  }

  function decideRequest(id: string, status: RequestStatus) {
    setRequests((items) =>
      items.map((item) =>
        item.id === id && item.status === 'PENDING' ? { ...item, status } : item,
      ),
    );
    record(
      status === 'APPROVED' ? 'requestApproved' : 'requestRejected',
      requests.find((item) => item.id === id)?.number ?? id,
    );
  }

  function addRequest(input: Pick<EquipmentRequest, 'equipmentId' | 'startDate' | 'endDate'>) {
    const number = `ЗЯ-${String(19 + requests.length - initial.requests.length).padStart(4, '0')}`;
    setRequests((items) => [
      { ...input, personId: person.id, id: crypto.randomUUID(), number, status: 'PENDING' },
      ...items,
    ]);
    record('created', number);
  }

  function returnLoan(id: string) {
    const loan = loans.find((item) => item.id === id && !item.returnedAt);
    if (!loan) return;
    setLoans((items) =>
      items.map((item) =>
        item.id === id ? { ...item, returnedAt: new Date().toISOString() } : item,
      ),
    );
    setEquipment((items) =>
      items.map((item) => (item.id === loan.equipmentId ? { ...item, status: 'AVAILABLE' } : item)),
    );
    record('returned', loan.number);
  }

  function moveEquipment(id: string, roomId: string) {
    const item = equipment.find((item) => item.id === id);
    if (!item || item.roomId === roomId || item.status === 'ISSUED') return false;
    setEquipment((items) => items.map((item) => (item.id === id ? { ...item, roomId } : item)));
    setMovements((items) => [
      {
        id: crypto.randomUUID(),
        equipmentId: id,
        fromRoomId: item.roomId,
        toRoomId: roomId,
        createdAt: new Date().toISOString(),
      },
      ...items,
    ]);
    record('updated', item.name);
    return true;
  }

  function updateProfile(name: string, email: string) {
    setPeople((items) =>
      items.map((item) => (item.id === person.id ? { ...item, name, email } : item)),
    );
    record('updated', name);
  }

  function completeCheck(roomId: string, found: number) {
    setChecks((items) => ({ ...items, [roomId]: { date: new Date().toISOString(), found } }));
    record('updated', `${roomId} · ${found}`);
  }

  return {
    equipment,
    requests,
    loans,
    people,
    movements,
    audit,
    checks,
    person,
    setPersonId,
    rooms: initial.rooms,
    categories: initial.categories,
    saveEquipment,
    deleteEquipment,
    decideRequest,
    addRequest,
    returnLoan,
    moveEquipment,
    updateProfile,
    completeCheck,
  };
}

const DemoContext = createContext<ReturnType<typeof useDemoState> | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const value = useDemoState();
  return <DemoContext value={value}>{children}</DemoContext>;
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error('DemoProvider is missing');
  return context;
}
