import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, expect, it } from 'vitest';
import { seedOperations } from '../prisma/operations-seed.js';

if (!new URL(process.env.DATABASE_URL ?? '').pathname.endsWith('_test'))
  throw new Error('An isolated _test database is required');
const db = new PrismaClient();
const users: string[] = [];
afterAll(async () => {
  await db.inventoryCheck.deleteMany({ where: { createdById: { in: users } } });
  await db.loan.deleteMany({ where: { recipientId: { in: users } } });
  await db.equipmentRequest.deleteMany({ where: { requesterId: { in: users } } });
  await db.movement.deleteMany({ where: { actorId: { in: users } } });
  const category = await db.category.findUnique({
    where: { id: 'de000000-0000-4000-8000-000000000002' },
  });
  if (category) {
    await db.equipment.deleteMany({ where: { categoryId: category.id } });
    await db.category.delete({ where: { id: category.id } });
    await db.room.deleteMany({
      where: {
        id: {
          in: ['de000000-0000-4000-8000-000000000003', 'de000000-0000-4000-8000-000000000004'],
        },
      },
    });
  }
  await db.auditEntry.deleteMany({ where: { actorId: { in: users } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});

it('seeds consistent demo operations once and preserves subsequent edits', async () => {
  for (const code of ['teacher', 'technician']) {
    const role = await db.role.upsert({ where: { code }, create: { code }, update: {} });
    const user = await db.user.create({
      data: {
        name: 'Seed test',
        email: `seed-${randomUUID()}@college.test`,
        passwordHash: 'unused-test-hash',
        roleId: role.id,
      },
    });
    users.push(user.id);
  }
  expect(await seedOperations(db, users[0], users[1])).toBe(true);
  const loans = await db.loan.findMany({
    where: { recipientId: users[0] },
    include: { items: { include: { equipment: true } } },
  });
  expect(loans).toHaveLength(3);
  expect(loans.filter((loan) => !loan.returnedAt)).toHaveLength(2);
  expect(loans.filter((loan) => !loan.returnedAt && loan.dueAt < new Date())).toHaveLength(1);
  for (const loan of loans)
    expect(loan.items[0].equipment.status).toBe(loan.returnedAt ? 'available' : 'issued');
  expect(await db.equipmentRequest.count({ where: { requesterId: users[0] } })).toBe(4);
  expect(await db.movement.count({ where: { actorId: users[1] } })).toBe(1);
  expect(
    await db.inventoryItem.count({
      where: { check: { createdById: users[1], completedAt: { not: null } }, found: true },
    }),
  ).toBe(1);
  const id = 'de000000-0000-4000-8000-000000000013';
  await db.equipment.update({ where: { id }, data: { name: 'Edited after seed' } });
  expect(await seedOperations(db, users[0], users[1])).toBe(false);
  expect((await db.equipment.findUniqueOrThrow({ where: { id } })).name).toBe(
    'Edited after seed',
  );
  expect(await db.loan.count({ where: { recipientId: users[0] } })).toBe(3);
});
