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
  throw new Error('An isolated _test database is required');
const db = new PrismaClient();
const app = createApp(
  new AuthService(new AuthRepository(db), config, () => undefined),
  config,
);
const suffix = randomUUID();
const users: { id: string; token: string }[] = [];
const rooms: string[] = [];
let categoryId: string;
const api = (method: 'get' | 'post' | 'patch' | 'delete', path: string, role = 1) => {
  const client = request(app);
  return client[method](`/api${path}`)
    .set('Origin', config.CLIENT_ORIGIN)
    .auth(users[role].token, { type: 'bearer' });
};
async function room(count = 2) {
  const created = await db.room.create({
    data: {
      number: randomUUID().slice(0, 20),
      name: `Inventory ${suffix}`,
      building: suffix,
      floor: 0,
    },
  });
  rooms.push(created.id);
  const equipment = [];
  for (let index = 0; index < count; index++)
    equipment.push(
      await db.equipment.create({
        data: {
          name: `Check item ${index}`,
          inventoryNumber: `CHECK-${randomUUID()}`,
          roomId: created.id,
          categoryId,
        },
      }),
    );
  return { roomId: created.id, equipment };
}
const create = async (roomId: string) =>
  (await api('post', '/inventory-checks').send({ roomId }).expect(201)).body.data as {
    id: string;
    number: number;
    createdById: string;
  };

beforeAll(async () => {
  const password = 'Inventory-test-password';
  const passwordHash = await bcrypt.hash(password, 4);
  for (const code of ['teacher', 'technician', 'admin']) {
    const role = await db.role.upsert({ where: { code }, create: { code }, update: {} });
    const email = `inventory-${code}-${suffix}@college.test`;
    const user = await db.user.create({
      data: { name: code, email, passwordHash, roleId: role.id },
    });
    const login = await request(app)
      .post('/api/auth/login')
      .set('Origin', config.CLIENT_ORIGIN)
      .send({ email, password })
      .expect(200);
    users.push({ id: user.id, token: login.body.data.accessToken as string });
  }
  categoryId = (await db.category.create({ data: { name: `Inventory ${suffix}` } })).id;
});
afterAll(async () => {
  const ids = users.map((user) => user.id);
  await db.inventoryItem.deleteMany({ where: { check: { createdById: { in: ids } } } });
  await db.inventoryCheck.deleteMany({ where: { createdById: { in: ids } } });
  await db.auditEntry.deleteMany({ where: { actorId: { in: ids } } });
  if (categoryId) await db.equipment.deleteMany({ where: { categoryId } });
  await db.room.deleteMany({ where: { id: { in: rooms } } });
  if (categoryId) await db.category.delete({ where: { id: categoryId } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});

describe('Inventory checks with PostgreSQL', () => {
  it('protects every route and rejects forged authors, invalid input and empty rooms', async () => {
    const fixture = await room(1);
    const check = await create(fixture.roomId);
    await request(app).get('/api/inventory-checks').expect(401);
    for (const [method, path, body] of [
      ['get', '/inventory-checks', undefined],
      ['post', '/inventory-checks', { roomId: fixture.roomId }],
      ['get', `/inventory-checks/${check.id}`, undefined],
      ['get', `/inventory-checks/${check.id}/items`, undefined],
      [
        'patch',
        `/inventory-checks/${check.id}/items/${fixture.equipment[0].id}`,
        { found: true },
      ],
      ['post', `/inventory-checks/${check.id}/complete`, {}],
    ] as const) {
      const call = api(method, path, 0);
      if (body) call.send(body);
      await call.expect(403);
    }
    await api('post', '/inventory-checks')
      .send({ roomId: fixture.roomId, createdById: users[0].id })
      .expect(422);
    await api('post', '/inventory-checks').send({ roomId: randomUUID() }).expect(404);
    await api('post', '/inventory-checks')
      .send({ roomId: (await room(0)).roomId })
      .expect(422);
    await api('patch', `/inventory-checks/${check.id}/items/${fixture.equipment[0].id}`)
      .send({ found: 'yes' })
      .expect(422);
    await api('get', '/inventory-checks?pageSize=101').expect(422);
    expect(check.createdById).toBe(users[1].id);
  });

  it('keeps the initial set, names, numbers and statuses after catalog changes', async () => {
    const fixture = await room(2);
    const check = await create(fixture.roomId);
    const moved = fixture.equipment[0];
    const target = await room(0);
    await db.equipment.update({
      where: { id: moved.id },
      data: {
        name: 'Renamed later',
        inventoryNumber: randomUUID(),
        roomId: target.roomId,
        status: 'repair',
      },
    });
    const items = await api(
      'get',
      `/inventory-checks/${check.id}/items?search=${moved.inventoryNumber}`,
    ).expect(200);
    expect(items.body.total).toBe(1);
    expect(items.body.data[0]).toMatchObject({
      equipmentId: moved.id,
      equipmentName: moved.name,
      inventoryNumber: moved.inventoryNumber,
      statusAtStart: 'available',
      found: null,
    });
    const detail = await api('get', `/inventory-checks/${check.id}`).expect(200);
    expect(detail.body.data.summary).toEqual({ total: 2, found: 0, missing: 0, pending: 2 });
    expect(JSON.stringify(detail.body)).not.toContain('password');
  });

  it('saves answers, requires a full check, records the completer and prevents later edits', async () => {
    const fixture = await room(2);
    const check = await create(fixture.roomId);
    const root = `/inventory-checks/${check.id}`;
    await api('patch', `${root}/items/${fixture.equipment[0].id}`)
      .send({ found: true })
      .expect(200);
    await api('post', `${root}/complete`).send({}).expect(409);
    expect(
      await db.auditEntry.count({
        where: { entityId: check.id, action: 'inventoryCompleted' },
      }),
    ).toBe(0);
    await api('patch', `${root}/items/${fixture.equipment[1].id}`)
      .send({ found: false })
      .expect(200);
    expect((await api('get', root)).body.data.summary).toEqual({
      total: 2,
      found: 1,
      missing: 1,
      pending: 0,
    });
    await api('post', `${root}/complete`, 2).send({}).expect(200);
    const detail = (await api('get', root).expect(200)).body.data;
    expect(detail.completedBy.id).toBe(users[2].id);
    expect(detail.completedAt).toBeTruthy();
    await api('patch', `${root}/items/${fixture.equipment[0].id}`)
      .send({ found: false })
      .expect(409);
    await api('post', `${root}/complete`).send({}).expect(409);
    expect(
      await db.auditEntry.count({
        where: { entityId: check.id, action: 'inventoryCompleted' },
      }),
    ).toBe(1);
    expect(
      await db.equipment.count({ where: { roomId: fixture.roomId, status: 'available' } }),
    ).toBe(2);
    await api('delete', `/equipment/${fixture.equipment[0].id}`).expect(409);
  });

  it('uses server filters, paging and sorting for history and items', async () => {
    const fixture = await room(3);
    const first = await create(fixture.roomId);
    const second = await create(fixture.roomId);
    const list = await api(
      'get',
      `/inventory-checks?roomId=${fixture.roomId}&status=active&sort=number&order=desc&pageSize=1&page=2`,
    ).expect(200);
    expect(list.body.total).toBe(2);
    expect(list.body.data[0].id).toBe(first.id);
    const search = await api('get', `/inventory-checks?search=${second.number}`).expect(200);
    expect(search.body.data.some((check: { id: string }) => check.id === second.id)).toBe(
      true,
    );
    const root = `/inventory-checks/${second.id}`;
    await api('patch', `${root}/items/${fixture.equipment[0].id}`)
      .send({ found: true })
      .expect(200);
    const pending = await api(
      'get',
      `${root}/items?state=pending&sort=equipmentName&order=asc&pageSize=1&page=2`,
    ).expect(200);
    expect(pending.body.total).toBe(2);
    expect(pending.body.data[0].equipmentName).toBe('Check item 2');
    const found = await api('get', `${root}/items?state=found`).expect(200);
    expect(found.body.total).toBe(1);
    await api('get', `${root}/items?sort=found`).expect(422);
    await api('get', `/inventory-checks/${randomUUID()}/items`).expect(404);
    await api('patch', `${root}/items/${randomUUID()}`).send({ found: true }).expect(404);
  });

  it('allows only one concurrent completion and keeps the result immutable', async () => {
    const fixture = await room(1);
    const check = await create(fixture.roomId);
    const root = `/inventory-checks/${check.id}`;
    await api('patch', `${root}/items/${fixture.equipment[0].id}`)
      .send({ found: true })
      .expect(200);
    const results = await Promise.all([
      api('post', `${root}/complete`).send({}),
      api('post', `${root}/complete`, 2).send({}),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(
      await db.auditEntry.count({
        where: { entityId: check.id, action: 'inventoryCompleted' },
      }),
    ).toBe(1);
    expect((await api('get', root)).body.data.summary).toEqual({
      total: 1,
      found: 1,
      missing: 0,
      pending: 0,
    });
  });

  it('serializes marking against completion without changing a completed report', async () => {
    const fixture = await room(1);
    const check = await create(fixture.roomId);
    const root = `/inventory-checks/${check.id}`;
    const path = `${root}/items/${fixture.equipment[0].id}`;
    await api('patch', path).send({ found: true }).expect(200);
    const [mark, complete] = await Promise.all([
      api('patch', path).send({ found: false }),
      api('post', `${root}/complete`, 2).send({}),
    ]);
    expect(complete.status).toBe(200);
    expect([200, 409]).toContain(mark.status);
    const detail = (await api('get', root)).body.data;
    expect(detail.summary.missing).toBe(mark.status === 200 ? 1 : 0);
    await api('patch', path).send({ found: true }).expect(409);
  });
});
