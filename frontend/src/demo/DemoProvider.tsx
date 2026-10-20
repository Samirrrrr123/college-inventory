import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  AuditEntry,
  Category,
  EquipmentInput,
  EquipmentRequest,
  Person,
  RequestStatus,
  Room,
} from '../domain/types';
import * as initial from './data';

function useDemoState() {
  const [equipment, setEquipment] = useState(initial.equipment);
  const [requests, setRequests] = useState(initial.requests);
  const [loans, setLoans] = useState(initial.loans);
  const [people, setPeople] = useState(initial.people);
  const [rooms, setRooms] = useState(initial.rooms);
  const [categories, setCategories] = useState(initial.categories);
  const [movements, setMovements] = useState(initial.movements);
  const [audit, setAudit] = useState(initial.audit);
  const [personId, setPersonId] = useState('samir');
  const [checks, setChecks] = useState<Record<string, { date: string; found: number }>>({});
  const person = people.find((item) => item.id === personId) ?? people[0];

  function record(action: AuditEntry['action'], subject: string) {
    setAudit((items) => [
      {
        id: crypto.randomUUID(),
        actorId: person.id,
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
      requests.some((item) => item.equipmentIds.includes(id)) ||
      loans.some((item) => item.equipmentIds.includes(id)) ||
      movements.some((item) => item.equipmentId === id)
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

  function addRequest(input: Pick<EquipmentRequest, 'equipmentIds' | 'purpose'>) {
    if (person.blocked) return 'accessDenied' as const;
    if (
      !input.equipmentIds.length ||
      new Set(input.equipmentIds).size !== input.equipmentIds.length
    )
      return 'chooseEquipment' as const;
    if (!input.purpose.trim()) return 'purposeRequired' as const;
    if (
      input.equipmentIds.some(
        (id) =>
          !equipment.some(
            (item) => item.id === id && ['AVAILABLE', 'ISSUED'].includes(item.status),
          ),
      )
    )
      return 'requestEquipmentUnavailable' as const;
    const number = `ЗЯ-${String(19 + requests.length - initial.requests.length).padStart(4, '0')}`;
    setRequests((items) => [
      {
        ...input,
        personId: person.id,
        id: crypto.randomUUID(),
        number,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      },
      ...items,
    ]);
    record('created', number);
    return 'saved' as const;
  }

  function issueLoan(input: {
    equipmentIds: string[];
    personId: string;
    dueDate: string;
    requestId: string | null;
  }) {
    if (person.role === 'TEACHER' || person.blocked) return 'accessDenied' as const;
    if (!people.some((item) => item.id === input.personId && !item.blocked))
      return 'invalidRecipient' as const;
    if (
      !input.equipmentIds.length ||
      new Set(input.equipmentIds).size !== input.equipmentIds.length
    )
      return 'chooseEquipment' as const;
    const dueTime = new Date(`${input.dueDate}T23:59:59+03:00`).getTime();
    if (!Number.isFinite(dueTime) || dueTime < Date.now()) return 'invalidDueDate' as const;
    if (input.requestId) {
      const request = requests.find((item) => item.id === input.requestId);
      if (
        !request ||
        request.status !== 'APPROVED' ||
        request.personId !== input.personId ||
        request.equipmentIds.length !== input.equipmentIds.length ||
        request.equipmentIds.some((id) => !input.equipmentIds.includes(id)) ||
        loans.some((item) => item.requestId === request.id)
      )
        return 'invalidIssueRequest' as const;
    }
    if (
      input.equipmentIds.some(
        (id) => !equipment.some((item) => item.id === id && item.status === 'AVAILABLE'),
      ) ||
      loans.some(
        (loan) =>
          !loan.returnedAt && loan.equipmentIds.some((id) => input.equipmentIds.includes(id)),
      )
    )
      return 'equipmentUnavailable' as const;
    const number = `ВД-${String(49 + loans.length - initial.loans.length).padStart(4, '0')}`;
    setLoans((items) => [
      {
        ...input,
        id: crypto.randomUUID(),
        number,
        issuedAt: new Date().toISOString(),
        returnedAt: null,
      },
      ...items,
    ]);
    setEquipment((items) =>
      items.map((item) =>
        input.equipmentIds.includes(item.id) ? { ...item, status: 'ISSUED' } : item,
      ),
    );
    record('issued', number);
    return 'saved' as const;
  }

  function returnLoan(id: string) {
    if (person.role === 'TEACHER' || person.blocked) return false;
    const loan = loans.find((item) => item.id === id && !item.returnedAt);
    if (!loan) return false;
    setLoans((items) =>
      items.map((item) =>
        item.id === id ? { ...item, returnedAt: new Date().toISOString() } : item,
      ),
    );
    setEquipment((items) =>
      items.map((item) =>
        loan.equipmentIds.includes(item.id) ? { ...item, status: 'AVAILABLE' } : item,
      ),
    );
    record('returned', loan.number);
    return true;
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
    if (
      people.some(
        (item) => item.id !== person.id && item.email.toLowerCase() === email.toLowerCase(),
      )
    )
      return 'duplicateEmail' as const;
    setPeople((items) =>
      items.map((item) => (item.id === person.id ? { ...item, name, email } : item)),
    );
    record('updated', name);
    return 'saved' as const;
  }

  function savePerson(input: Omit<Person, 'id'>, id?: string) {
    if (person.role !== 'ADMIN' || person.blocked) return 'accessDenied' as const;
    if (
      people.some(
        (item) => item.id !== id && item.email.toLowerCase() === input.email.toLowerCase(),
      )
    )
      return 'duplicateEmail' as const;
    const previous = people.find((item) => item.id === id);
    if (
      previous?.role === 'ADMIN' &&
      !previous.blocked &&
      (input.role !== 'ADMIN' || input.blocked) &&
      !people.some((item) => item.id !== id && item.role === 'ADMIN' && !item.blocked)
    )
      return 'lastAdmin' as const;
    if (id === person.id && input.blocked) return 'selfBlock' as const;
    setPeople((items) =>
      id
        ? items.map((item) => (item.id === id ? { ...input, id } : item))
        : [...items, { ...input, id: crypto.randomUUID() }],
    );
    record(id ? 'updated' : 'created', input.name);
    return 'saved' as const;
  }

  function saveRoom(input: Omit<Room, 'id'>, id?: string) {
    if (person.role === 'TEACHER' || person.blocked) return 'accessDenied' as const;
    if (
      rooms.some(
        (item) => item.id !== id && item.number.toLowerCase() === input.number.toLowerCase(),
      )
    )
      return 'duplicateRoom' as const;
    setRooms((items) =>
      id
        ? items.map((item) => (item.id === id ? { ...input, id } : item))
        : [...items, { ...input, id: crypto.randomUUID() }],
    );
    record(id ? 'updated' : 'created', input.number);
    return 'saved' as const;
  }

  function deleteRoom(id: string) {
    if (person.role === 'TEACHER' || person.blocked) return 'accessDenied' as const;
    if (
      equipment.some((item) => item.roomId === id) ||
      checks[id] ||
      movements.some((item) => item.fromRoomId === id || item.toRoomId === id)
    )
      return 'linkedDirectory' as const;
    if (rooms.length <= 1) return 'lastDirectory' as const;
    setRooms((items) => items.filter((item) => item.id !== id));
    record('deleted', rooms.find((item) => item.id === id)?.number ?? id);
    return 'deleted' as const;
  }

  function saveCategory(input: Omit<Category, 'id'>, id?: string) {
    if (person.role !== 'ADMIN' || person.blocked) return 'accessDenied' as const;
    if (
      categories.some(
        (item) =>
          item.id !== id &&
          Object.values(item.title).some((title) =>
            Object.values(input.title).some((value) => value.toLowerCase() === title.toLowerCase()),
          ),
      )
    )
      return 'duplicateCategory' as const;
    setCategories((items) =>
      id
        ? items.map((item) => (item.id === id ? { ...input, id } : item))
        : [...items, { ...input, id: crypto.randomUUID() }],
    );
    record(id ? 'updated' : 'created', input.title.ru);
    return 'saved' as const;
  }

  function deleteCategory(id: string) {
    if (person.role !== 'ADMIN' || person.blocked) return 'accessDenied' as const;
    if (equipment.some((item) => item.categoryId === id)) return 'linkedDirectory' as const;
    if (categories.length <= 1) return 'lastDirectory' as const;
    setCategories((items) => items.filter((item) => item.id !== id));
    record('deleted', categories.find((item) => item.id === id)?.title.ru ?? id);
    return 'deleted' as const;
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
    rooms,
    categories,
    saveEquipment,
    deleteEquipment,
    decideRequest,
    addRequest,
    issueLoan,
    returnLoan,
    moveEquipment,
    updateProfile,
    completeCheck,
    savePerson,
    saveRoom,
    deleteRoom,
    saveCategory,
    deleteCategory,
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
