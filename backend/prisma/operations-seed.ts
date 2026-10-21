import type { PrismaClient } from '@prisma/client';

const identifier = (number: number) =>
  `de000000-0000-4000-8000-${String(number).padStart(12, '0')}`;

export function seedOperations(db: PrismaClient, teacherId: string, technicianId: string) {
  return db.$transaction(async (tx) => {
    if (await tx.auditEntry.findUnique({ where: { id: identifier(1) } })) return false;
    const category = await tx.category.create({
      data: { id: identifier(2), name: 'Учебные сценарии (seed)' },
    });
    const firstRoom = await tx.room.create({
      data: {
        id: identifier(3),
        number: 'S-01',
        name: 'Учебный склад',
        building: 'Сценарии (seed)',
        floor: 0,
      },
    });
    const secondRoom = await tx.room.create({
      data: {
        id: identifier(4),
        number: 'S-02',
        name: 'Учебный кабинет',
        building: 'Сценарии (seed)',
        floor: 1,
      },
    });
    const now = new Date();
    const yesterday = new Date(now.getTime() - 86400000);
    const tomorrow = new Date(now.getTime() + 86400000);
    for (let index = 0; index < 4; index++)
      await tx.equipment.create({
        data: {
          id: identifier(10 + index),
          name: `Учебный комплект ${index + 1}`,
          inventoryNumber: `SCENARIO-${index + 1}`,
          description: 'Отдельные данные для демонстрации операций',
          categoryId: category.id,
          roomId: firstRoom.id,
          status: index < 2 ? 'issued' : 'available',
        },
      });
    for (let index = 0; index < 3; index++) {
      const request = await tx.equipmentRequest.create({
        data: {
          id: identifier(20 + index),
          requesterId: teacherId,
          reviewerId: technicianId,
          reviewedAt: yesterday,
          status: 'approved',
          purpose: 'Учебный сценарий выдачи',
          items: { create: { equipmentId: identifier(10 + index) } },
        },
      });
      await tx.loan.create({
        data: {
          id: identifier(30 + index),
          requestId: request.id,
          recipientId: teacherId,
          issuedById: technicianId,
          issuedAt: yesterday,
          dueAt: index === 1 ? yesterday : tomorrow,
          returnedAt: index === 2 ? now : null,
          returnedById: index === 2 ? technicianId : null,
          items: { create: { equipmentId: identifier(10 + index) } },
        },
      });
    }
    await tx.equipmentRequest.create({
      data: {
        id: identifier(23),
        requesterId: teacherId,
        purpose: 'Ожидающая заявка без резервирования',
        items: { create: { equipmentId: identifier(13) } },
      },
    });
    await tx.equipment.update({
      where: { id: identifier(13) },
      data: { roomId: secondRoom.id },
    });
    await tx.movement.create({
      data: {
        id: identifier(40),
        equipmentId: identifier(13),
        fromRoomId: firstRoom.id,
        toRoomId: secondRoom.id,
        actorId: technicianId,
        reason: 'Демонстрация перемещения',
      },
    });
    await tx.inventoryCheck.create({
      data: {
        id: identifier(50),
        roomId: secondRoom.id,
        createdById: technicianId,
        completedById: technicianId,
        completedAt: now,
        items: {
          create: {
            equipmentId: identifier(13),
            equipmentName: 'Учебный комплект 4',
            inventoryNumber: 'SCENARIO-4',
            statusAtStart: 'available',
            found: true,
            checkedAt: now,
          },
        },
      },
    });
    await tx.auditEntry.create({
      data: {
        id: identifier(1),
        actorId: technicianId,
        action: 'demoOperationsSeeded',
        entityType: 'demo',
        details: { requests: 4, loans: 3, movements: 1, checks: 1 },
      },
    });
    return true;
  });
}
