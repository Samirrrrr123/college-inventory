import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { AuthRepository } from '../src/auth/repository.js';
import { AuthService } from '../src/auth/service.js';
import { seedCatalog } from '../prisma/catalog-seed.js';

const database = process.env.DATABASE_URL;
if (!database || !new URL(database).pathname.endsWith('_test'))
  throw new Error('Catalog tests require an isolated database ending in _test');
const db = new PrismaClient();
const config = loadConfig(process.env);
const app = createApp(
  new AuthService(new AuthRepository(db), config, () => undefined),
  config,
);
const suffix = randomUUID();
const prefix = `TEST-${suffix.toUpperCase()}`;
const password = 'Catalog-Password-2026';
const clients: Record<string, { id: string; token: string }> = {};
const api = (
  method: 'get' | 'post' | 'patch' | 'delete',
  path: string,
  role = 'technician',
) => {
  const call = request(app)[method](`/api${path}`).set('Origin', config.CLIENT_ORIGIN);
  return clients[role] ? call.auth(clients[role].token, { type: 'bearer' }) : call;
};
let categoryId: string;
let roomId: string;
let secondRoomId: string;
let counter = 0;
async function equipment(input: object = {}) {
  const response = await api('post', '/equipment')
    .send({
      name: `Laptop ${suffix}`,
      inventoryNumber: `${prefix}-${++counter}`,
      categoryId,
      roomId,
      ...input,
    })
    .expect(201);
  return response.body.data as {
    id: string;
    inventoryNumber: string;
    status: string;
    roomId: string;
  };
}

beforeAll(async () => {
  await db.$connect();
  for (const role of ['teacher', 'technician', 'admin']) {
    const email = `catalog-${role}-${suffix}@college.test`;
    const created = await request(app)
      .post('/api/auth/register')
      .set('Origin', config.CLIENT_ORIGIN)
      .send({ name: `Catalog ${role}`, email, password })
      .expect(201);
    await db.user.update({
      where: { id: created.body.data.id },
      data: { role: { connect: { code: role } } },
    });
    const login = await request(app)
      .post('/api/auth/login')
      .set('Origin', config.CLIENT_ORIGIN)
      .send({ email, password })
      .expect(200);
    clients[role] = { id: created.body.data.id, token: login.body.data.accessToken };
  }
  categoryId = (
    await api('post', '/categories')
      .send({ name: `Category ${suffix}` })
      .expect(201)
  ).body.data.id;
  roomId = (
    await api('post', '/rooms')
      .send({ number: 'A', name: `Room ${suffix}`, building: suffix, floor: 0 })
      .expect(201)
  ).body.data.id;
  secondRoomId = (
    await api('post', '/rooms')
      .send({ number: 'B', name: `Room B ${suffix}`, building: suffix, floor: 1 })
      .expect(201)
  ).body.data.id;
}, 20000);

afterAll(async () => {
  const owned = await db.equipment.findMany({
    where: { inventoryNumber: { startsWith: prefix } },
    select: { id: true },
  });
  await db.movement.deleteMany({
    where: { equipmentId: { in: owned.map((item) => item.id) } },
  });
  await db.equipment.deleteMany({ where: { id: { in: owned.map((item) => item.id) } } });
  await db.category.deleteMany({ where: { name: { contains: suffix } } });
  await db.room.deleteMany({ where: { building: suffix } });
  const users = await db.user.findMany({
    where: { email: { contains: suffix } },
    select: { id: true },
  });
  await db.auditEntry.deleteMany({ where: { actorId: { in: users.map((user) => user.id) } } });
  await db.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
  await db.$disconnect();
});

describe('Catalog API with PostgreSQL', () => {
  it('requires a real session and checks all three roles on the server', async () => {
    for (const path of ['/equipment', '/categories', '/rooms']) {
      await request(app).get(`/api${path}`).expect(401);
      await api('get', path, 'teacher').expect(200);
      await api('post', path, 'teacher').send({}).expect(403);
      await api('patch', `${path}/${randomUUID()}`, 'teacher').send({}).expect(403);
      await api('delete', `${path}/${randomUUID()}`, 'teacher').expect(403);
      await api('get', path, 'admin').expect(200);
    }
  });

  it('creates, reads, partially edits and physically deletes unreferenced equipment', async () => {
    const item = await equipment({
      status: 'repair',
      description: 'Keep this description',
      serialNumber: 'Keep serial',
    });
    const first = await api('get', `/equipment/${item.id}`, 'teacher').expect(200);
    expect(first.body.data.category.id).toBe(categoryId);
    expect(first.body.data.room.id).toBe(roomId);
    expect(first.body.data.attachmentId).toBeNull();
    const updated = await api('patch', `/equipment/${item.id}`)
      .send({ name: 'Renamed laptop' })
      .expect(200);
    expect(updated.body.data).toMatchObject({
      name: 'Renamed laptop',
      status: 'repair',
      description: 'Keep this description',
      serialNumber: 'Keep serial',
      roomId,
    });
    await api('delete', `/equipment/${item.id}`, 'admin').expect(204);
    await api('get', `/equipment/${item.id}`).expect(404);
    expect(await db.equipment.findUnique({ where: { id: item.id } })).toBeNull();
    const audit = await db.auditEntry.findMany({
      where: { entityId: item.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(audit.map((row) => row.action)).toEqual([
      'equipmentCreated',
      'equipmentUpdated',
      'equipmentDeleted',
    ]);
  });

  it('normalizes inventory numbers and rejects duplicate create and update with field errors', async () => {
    const first = await equipment({ inventoryNumber: `  ${prefix.toLowerCase()}-case  ` });
    expect(first.inventoryNumber).toBe(`${prefix}-CASE`);
    const duplicate = await api('post', '/equipment')
      .send({
        name: 'Duplicate',
        inventoryNumber: `${prefix.toLowerCase()}-case`,
        categoryId,
        roomId,
      })
      .expect(409);
    expect(duplicate.body.error).toMatchObject({
      code: 'INVENTORY_NUMBER_EXISTS',
      fields: { inventoryNumber: 'Already in use' },
    });
    const second = await equipment();
    await api('patch', `/equipment/${second.id}`)
      .send({ inventoryNumber: first.inventoryNumber })
      .expect(409);
    expect(
      (await db.equipment.findUniqueOrThrow({ where: { id: second.id } })).inventoryNumber,
    ).toBe(second.inventoryNumber);
  });

  it('enforces inventory uniqueness even when two requests race', async () => {
    const input = {
      name: `Race ${suffix}`,
      inventoryNumber: `${prefix}-RACE`,
      categoryId,
      roomId,
    };
    const results = await Promise.all([
      api('post', '/equipment').send(input),
      api('post', '/equipment').send(input),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(
      await db.equipment.count({ where: { inventoryNumber: input.inventoryNumber } }),
    ).toBe(1);
  });

  it('does not allow deleting referenced categories or rooms and translates missing foreign keys', async () => {
    await equipment();
    await api('delete', `/categories/${categoryId}`).expect(409);
    await api('delete', `/rooms/${roomId}`).expect(409);
    await api('post', '/equipment')
      .send({
        name: 'Invalid reference',
        inventoryNumber: `${prefix}-MISSING`,
        categoryId: randomUUID(),
        roomId,
      })
      .expect(409);
    expect(await db.equipment.count({ where: { inventoryNumber: `${prefix}-MISSING` } })).toBe(
      0,
    );
  });

  it('records room changes atomically and protects the resulting history', async () => {
    const item = await equipment();
    await api('patch', `/equipment/${item.id}`).send({ roomId: secondRoomId }).expect(200);
    const movements = await db.movement.findMany({ where: { equipmentId: item.id } });
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      fromRoomId: roomId,
      toRoomId: secondRoomId,
      actorId: clients.technician.id,
    });
    await api('delete', `/equipment/${item.id}`).expect(409);
    await api('delete', `/rooms/${roomId}`).expect(409);
    expect((await db.equipment.findUniqueOrThrow({ where: { id: item.id } })).roomId).toBe(
      secondRoomId,
    );
    const count = await db.auditEntry.count({
      where: { entityId: item.id, action: 'equipmentUpdated' },
    });
    await api('patch', `/equipment/${item.id}`).send({ roomId: randomUUID() }).expect(409);
    expect(await db.movement.count({ where: { equipmentId: item.id } })).toBe(1);
    expect(
      await db.auditEntry.count({ where: { entityId: item.id, action: 'equipmentUpdated' } }),
    ).toBe(count);
  });

  it('protects issued units and rejects direct assignment of issued status', async () => {
    const item = await equipment();
    await db.equipment.update({ where: { id: item.id }, data: { status: 'issued' } });
    await api('patch', `/equipment/${item.id}`).send({ status: 'repair' }).expect(409);
    await api('patch', `/equipment/${item.id}`).send({ roomId: secondRoomId }).expect(409);
    await api('delete', `/equipment/${item.id}`).expect(409);
    await api('patch', `/equipment/${item.id}`).send({ name: 'Issued label' }).expect(200);
    await api('post', '/equipment')
      .send({
        name: 'Tamper',
        inventoryNumber: `${prefix}-TAMPER`,
        categoryId,
        roomId,
        status: 'issued',
      })
      .expect(422);
    await api('patch', `/equipment/${item.id}`).send({ status: 'issued' }).expect(422);
  });

  it('searches, filters, sorts and paginates actual matching rows with stable ordering', async () => {
    const created = [];
    for (const name of ['C', 'A', 'B', 'B'])
      created.push(await equipment({ name: `Search-${suffix}-${name}`, status: 'repair' }));
    const filter = `search=search-${suffix}&categoryId=${categoryId}&roomId=${roomId}&status=repair&sort=name&order=asc&pageSize=2`;
    const first = await api('get', `/equipment?${filter}&page=1`, 'teacher').expect(200);
    const second = await api('get', `/equipment?${filter}&page=2`, 'teacher').expect(200);
    expect(first.body).toMatchObject({ page: 1, pageSize: 2, total: 4 });
    const expected = await db.equipment.findMany({
      where: { id: { in: created.map((item) => item.id) } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    expect(
      [...first.body.data, ...second.body.data].map((item: { id: string }) => item.id),
    ).toEqual(expected.map((item) => item.id));
    const beyond = await api('get', `/equipment?${filter}&page=3`).expect(200);
    expect(beyond.body.data).toEqual([]);
    expect(beyond.body.total).toBe(4);
    const serial = await equipment({ serialNumber: `Serial-${suffix}` });
    const serialSearch = await api('get', `/equipment?search=serial-${suffix}`).expect(200);
    expect(serialSearch.body.data.map((item: { id: string }) => item.id)).toContain(serial.id);
    const descending = await api(
      'get',
      `/equipment?${filter.replace('order=asc', 'order=desc')}&page=1`,
    ).expect(200);
    expect(descending.body.data[0].name).toBe(`Search-${suffix}-C`);
  });

  it('validates unknown fields, IDs, filters, sort names, limits and empty PATCH requests', async () => {
    for (const path of ['/equipment', '/categories', '/rooms']) {
      await api('get', `${path}/not-a-uuid`).expect(422);
      await api('get', `${path}/${randomUUID()}`).expect(404);
      await api('patch', `${path}/${randomUUID()}`).send({}).expect(422);
      await api('get', `${path}?pageSize=101`).expect(422);
      await api('get', `${path}?page=0`).expect(422);
    }
    for (const query of [
      'sort=passwordHash',
      'status=AVAILABLE',
      'roomId=invalid',
      'page=1.5',
      'categoryId=invalid',
      'unknown=value',
      'order=random',
    ])
      await api('get', `/equipment?${query}`).expect(422);
    await api('post', '/equipment')
      .send({
        name: 'Tamper',
        inventoryNumber: `${prefix}-FIELD`,
        categoryId,
        roomId,
        actorId: clients.admin.id,
      })
      .expect(422);
    const injected = await api(
      'get',
      `/equipment?search=${encodeURIComponent("' OR 1=1 --")}`,
    ).expect(200);
    expect(injected.body.total).toBe(0);
  });

  it('implements the complete category lifecycle and database uniqueness', async () => {
    const created = await api('post', '/categories', 'admin')
      .send({ name: `Lifecycle ${suffix}` })
      .expect(201);
    const id = created.body.data.id;
    await api('get', `/categories/${id}`, 'teacher').expect(200);
    await api('post', '/categories')
      .send({ name: `Lifecycle ${suffix}` })
      .expect(409);
    await api('patch', `/categories/${id}`)
      .send({ name: `Renamed ${suffix}` })
      .expect(200);
    await api('patch', `/categories/${id}`)
      .send({ name: `Category ${suffix}` })
      .expect(409);
    const listing = await api(
      'get',
      `/categories?search=${suffix}&pageSize=1&sort=name&order=desc`,
    ).expect(200);
    expect(listing.body.total).toBeGreaterThanOrEqual(2);
    expect(listing.body.data).toHaveLength(1);
    await api('delete', `/categories/${id}`).expect(204);
    await api('patch', `/categories/${id}`).send({ name: 'Missing' }).expect(404);
    await api('delete', `/categories/${id}`).expect(404);
  });

  it('implements the complete room lifecycle with building, floor and uniqueness filters', async () => {
    const created = await api('post', '/rooms', 'admin')
      .send({ number: 'C', name: `Lifecycle room ${suffix}`, building: suffix, floor: -1 })
      .expect(201);
    const id = created.body.data.id;
    await api('get', `/rooms/${id}`, 'teacher').expect(200);
    await api('post', '/rooms')
      .send({ number: 'C', name: 'Duplicate', building: suffix, floor: 0 })
      .expect(409);
    await api('patch', `/rooms/${id}`)
      .send({ name: `Updated room ${suffix}` })
      .expect(200);
    const listing = await api(
      'get',
      `/rooms?building=${suffix}&floor=-1&search=${suffix}&sort=floor&order=desc`,
    ).expect(200);
    expect(listing.body.total).toBe(1);
    expect(listing.body.data[0].id).toBe(id);
    await api('delete', `/rooms/${id}`).expect(204);
    await api('patch', `/rooms/${id}`).send({ name: 'Missing' }).expect(404);
    await api('delete', `/rooms/${id}`).expect(404);
  });

  it('keeps audit history scoped to its actor and exposes catalog routes in Swagger', async () => {
    const own = await api('get', '/me/activity?pageSize=100').expect(200);
    expect(
      own.body.data.every((row: { actorId: string }) => row.actorId === clients.technician.id),
    ).toBe(true);
    expect(
      own.body.data.some((row: { entityType: string }) => row.entityType === 'equipment'),
    ).toBe(true);
    const spec = await request(app).get('/api/openapi.json').expect(200);
    for (const path of [
      '/equipment',
      '/equipment/{id}',
      '/categories',
      '/categories/{id}',
      '/rooms',
      '/rooms/{id}',
    ])
      expect(spec.body.paths[path]).toBeDefined();
    expect(spec.body.components.schemas.Equipment.properties.status.enum).toEqual([
      'available',
      'issued',
      'repair',
      'written_off',
    ]);
    await request(app).get('/api/docs/').expect(200);
    await request(app)
      .post('/api/categories')
      .set('Origin', 'https://attacker.example')
      .auth(clients.admin.token, { type: 'bearer' })
      .send({ name: 'Cross origin' })
      .expect(403);
  });

  it('seeds more than one page reproducibly without overwriting existing equipment', async () => {
    await seedCatalog(db);
    const original = await db.equipment.findUniqueOrThrow({
      where: { inventoryNumber: 'DEMO-0001' },
    });
    await db.equipment.update({
      where: { id: original.id },
      data: { name: 'Keep local changes' },
    });
    try {
      await seedCatalog(db);
      expect(
        await db.equipment.count({ where: { inventoryNumber: { startsWith: 'DEMO-' } } }),
      ).toBe(36);
      expect((await db.equipment.findUniqueOrThrow({ where: { id: original.id } })).name).toBe(
        'Keep local changes',
      );
      const result = await api('get', '/equipment?search=DEMO-&pageSize=20').expect(200);
      expect(result.body.total).toBe(36);
      expect(result.body.data).toHaveLength(20);
    } finally {
      await db.equipment.update({ where: { id: original.id }, data: { name: original.name } });
    }
  });
});
