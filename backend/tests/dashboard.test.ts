import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { AuthRepository } from '../src/auth/repository.js';
import { AuthService } from '../src/auth/service.js';

const config = loadConfig(process.env);
if (!new URL(config.DATABASE_URL).pathname.endsWith('_test'))
  throw new Error('Test database required');
const db = new PrismaClient();
const app = createApp(
  new AuthService(new AuthRepository(db), config, () => undefined),
  config,
);
const suffix = randomUUID();
const users: { id: string; token: string }[] = [];
let roomId: string;
let categoryId: string;
const equipmentIds: string[] = [];
const get = (index: number, query = '') =>
  request(app).get(`/api/dashboard${query}`).auth(users[index].token, { type: 'bearer' });

beforeAll(async () => {
  const password = 'Dashboard-test-password';
  const passwordHash = await bcrypt.hash(password, 4);
  for (const [index, code] of ['teacher', 'teacher', 'technician', 'admin'].entries()) {
    const role = await db.role.upsert({ where: { code }, create: { code }, update: {} });
    const email = `dashboard-${index}-${suffix}@college.test`;
    const user = await db.user.create({
      data: { name: `Dashboard ${index}`, email, passwordHash, roleId: role.id },
    });
    const login = await request(app)
      .post('/api/auth/login')
      .set('Origin', config.CLIENT_ORIGIN)
      .send({ email, password })
      .expect(200);
    users.push({ id: user.id, token: login.body.data.accessToken as string });
  }
  roomId = (
    await db.room.create({
      data: {
        number: suffix.slice(0, 20),
        name: 'Dashboard room',
        building: suffix,
        floor: 1,
      },
    })
  ).id;
  categoryId = (await db.category.create({ data: { name: suffix } })).id;
  for (const [index, status] of (
    ['available', 'issued', 'repair', 'written_off'] as const
  ).entries()) {
    equipmentIds.push(
      (
        await db.equipment.create({
          data: {
            name: `Dashboard item ${index}`,
            inventoryNumber: `D-${suffix}-${index}`,
            status,
            categoryId,
            roomId,
          },
        })
      ).id,
    );
  }
  for (const [index, user] of users.slice(0, 2).entries()) {
    for (let n = 0; n < 4; n++) {
      await db.equipmentRequest.create({
        data: {
          requesterId: user.id,
          purpose: 'Dashboard request',
          status: n === 3 ? 'cancelled' : 'pending',
          createdAt: new Date(Date.UTC(2026, 0, n + 1)),
          items: { create: { equipmentId: equipmentIds[0] } },
        },
      });
      await db.loan.create({
        data: {
          recipientId: user.id,
          issuedById: users[2].id,
          dueAt: new Date('2020-01-01Z'),
          returnedAt: n === 3 ? new Date() : null,
          items: { create: { equipmentId: equipmentIds[1] } },
        },
      });
    }
    if (index === 0)
      await db.loan.create({
        data: {
          recipientId: user.id,
          issuedById: users[2].id,
          dueAt: new Date('2099-01-01Z'),
        },
      });
  }
});
afterAll(async () => {
  const ids = users.map((user) => user.id);
  await db.loan.deleteMany({ where: { recipientId: { in: ids } } });
  await db.equipmentRequest.deleteMany({ where: { requesterId: { in: ids } } });
  await db.equipment.deleteMany({ where: { id: { in: equipmentIds } } });
  await db.auditEntry.deleteMany({ where: { actorId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  if (roomId) await db.room.delete({ where: { id: roomId } });
  if (categoryId) await db.category.delete({ where: { id: categoryId } });
  await db.$disconnect();
});
describe('Dashboard with PostgreSQL', () => {
  it('requires a valid session', async () => {
    await request(app).get('/api/dashboard').expect(401);
  });
  it('keeps teacher counts and latest records scoped even with a forged account query', async () => {
    const {
      body: { data },
    } = await get(0, `?requesterId=${users[1].id}&recipientId=${users[1].id}`).expect(200);
    expect(data).toMatchObject({
      scope: 'own',
      activeLoans: 4,
      overdueLoans: 3,
      pendingRequests: 3,
    });
    expect(data.latestRequests).toHaveLength(3);
    expect(
      data.latestRequests.map((row: { requester: { id: string } }) => row.requester.id),
    ).toEqual(Array(3).fill(users[0].id));
    expect(data.latestRequests.map((row: { status: string }) => row.status)).toEqual([
      'cancelled',
      'pending',
      'pending',
    ]);
    expect(data.overdue).toHaveLength(3);
    expect(
      data.overdue.every(
        (row: { recipient: { id: string } }) => row.recipient.id === users[0].id,
      ),
    ).toBe(true);
    expect(JSON.stringify(data)).not.toMatch(/passwordHash|refreshHash|@college.test/);
    const other = await get(1).expect(200);
    expect(other.body.data.activeLoans).toBe(3);
    expect(
      other.body.data.latestRequests.every(
        (row: { requester: { id: string } }) => row.requester.id === users[1].id,
      ),
    ).toBe(true);
  });
  it('returns exact global counters to both staff roles', async () => {
    const now = new Date();
    for (const role of [2, 3]) {
      const {
        body: { data },
      } = await get(role).expect(200);
      expect(data.scope).toBe('all');
      expect(data.totalEquipment).toBe(await db.equipment.count());
      expect(data.rooms).toBe(await db.room.count());
      expect(data.activeLoans).toBe(await db.loan.count({ where: { returnedAt: null } }));
      expect(data.pendingRequests).toBe(
        await db.equipmentRequest.count({ where: { status: 'pending' } }),
      );
      expect(data.overdueLoans).toBe(
        await db.loan.count({ where: { returnedAt: null, dueAt: { lt: now } } }),
      );
      for (const status of ['available', 'issued', 'repair', 'written_off'] as const)
        expect(data.equipment[status]).toBe(await db.equipment.count({ where: { status } }));
      expect(data.latestRequests.length).toBeLessThanOrEqual(3);
      expect(data.overdue.length).toBeLessThanOrEqual(3);
    }
  });
  it('reflects a returned loan on the next read and excludes blocked sessions', async () => {
    const loan = await db.loan.findFirstOrThrow({
      where: { recipientId: users[0].id, returnedAt: null, dueAt: { lt: new Date() } },
    });
    await db.loan.update({ where: { id: loan.id }, data: { returnedAt: new Date() } });
    expect((await get(0).expect(200)).body.data).toMatchObject({
      activeLoans: 3,
      overdueLoans: 2,
    });
    await db.user.update({ where: { id: users[1].id }, data: { isBlocked: true } });
    await get(1).expect(401);
  });
});
