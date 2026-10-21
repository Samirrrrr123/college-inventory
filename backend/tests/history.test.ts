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
const moves: string[] = [];
const equipment: string[] = [];
let categoryId: string;
const api = (path: string, role = 2) =>
  request(app).get(`/api${path}`).auth(users[role].token, { type: 'bearer' });
beforeAll(async () => {
  const password = 'History-test-password';
  const passwordHash = await bcrypt.hash(password, 4);
  for (const [index, code] of ['teacher', 'technician', 'admin'].entries()) {
    const role = await db.role.upsert({ where: { code }, create: { code }, update: {} });
    const email = `history-${index}-${suffix}@college.test`;
    const user = await db.user.create({
      data: { name: `History ${index} ${suffix}`, email, passwordHash, roleId: role.id },
    });
    const login = await request(app)
      .post('/api/auth/login')
      .set('Origin', config.CLIENT_ORIGIN)
      .send({ email, password })
      .expect(200);
    users.push({ id: user.id, token: login.body.data.accessToken as string });
  }
  categoryId = (await db.category.create({ data: { name: `History ${suffix}` } })).id;
  for (let index = 0; index < 2; index++)
    rooms.push(
      (
        await db.room.create({
          data: {
            number: String(index),
            name: `History room ${index}`,
            building: suffix,
            floor: 0,
          },
        })
      ).id,
    );
  for (let index = 0; index < 3; index++) {
    const item = await db.equipment.create({
      data: {
        name: `History equipment ${index} ${suffix}`,
        inventoryNumber: `HIST-${suffix}-${index}`,
        categoryId,
        roomId: rooms[0],
      },
    });
    equipment.push(item.id);
    await request(app)
      .patch(`/api/equipment/${item.id}`)
      .auth(users[1].token, { type: 'bearer' })
      .set('Origin', config.CLIENT_ORIGIN)
      .send({ roomId: rooms[1] })
      .expect(200);
    const move = await db.movement.findFirstOrThrow({ where: { equipmentId: item.id } });
    moves.push(move.id);
    await db.movement.update({
      where: { id: move.id },
      data: { createdAt: new Date('2026-01-20T12:00:00.000Z') },
    });
  }
});
afterAll(async () => {
  const ids = users.map((user) => user.id);
  await db.movement.deleteMany({ where: { actorId: { in: ids } } });
  if (categoryId) await db.equipment.deleteMany({ where: { categoryId } });
  await db.auditEntry.deleteMany({ where: { actorId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.room.deleteMany({ where: { id: { in: rooms } } });
  if (categoryId) await db.category.deleteMany({ where: { id: categoryId } });
  await db.$disconnect();
});

describe('Read-only movement and audit APIs with PostgreSQL', () => {
  it('requires a session and checks staff/admin roles independently', async () => {
    for (const path of ['/movements', '/audit']) {
      await request(app).get(`/api${path}`).expect(401);
      await api(path, 0).expect(403);
    }
    await api('/movements', 1).expect(200);
    await api('/audit', 1).expect(403);
    await api('/movements').expect(200);
    await api('/audit').expect(200);
  });

  it('reads real movements created by the existing equipment PATCH with related names', async () => {
    const response = await api(`/movements?equipmentId=${equipment[0]}`, 1).expect(200);
    expect(response.body.total).toBe(1);
    expect(response.body.data[0]).toMatchObject({
      equipmentId: equipment[0],
      fromRoomId: rooms[0],
      toRoomId: rooms[1],
      actorId: users[1].id,
      equipment: { id: equipment[0], inventoryNumber: `HIST-${suffix}-0` },
      actor: { name: `History 1 ${suffix}` },
      fromRoom: { building: suffix },
      toRoom: { name: 'History room 1' },
    });
    expect(response.body.data[0].reason).toBe('Room changed in equipment card');
  });

  it('filters and searches movements with timezone boundaries and stable pagination', async () => {
    const query = `search=${suffix}&actorId=${users[1].id}&actorSearch=history%201&fromRoomId=${rooms[0]}&toRoomId=${rooms[1]}&from=2026-01-20T15%3A00%3A00%2B03%3A00&to=2026-01-20T12%3A00%3A00Z&order=asc&pageSize=1`;
    const ids: string[] = [];
    for (let page = 1; page <= 3; page++) {
      const response = await api(`/movements?${query}&page=${page}`).expect(200);
      expect(response.body.total).toBe(3);
      expect(response.body.data).toHaveLength(1);
      ids.push(response.body.data[0].id as string);
    }
    expect(ids).toEqual([...moves].sort());
    const search = await api(
      `/movements?search=${encodeURIComponent(`HIST-${suffix}-1`)}`,
    ).expect(200);
    expect(search.body.total).toBe(1);
    expect(search.body.data[0].equipmentId).toBe(equipment[1]);
    const empty = await api(`/movements?search=${randomUUID()}`).expect(200);
    expect(empty.body).toMatchObject({ data: [], total: 0, page: 1, pageSize: 20 });
  });

  it('filters domain audit and resolves subjects without loading credentials', async () => {
    const response = await api(
      `/audit?entityType=equipment&entityId=${equipment[0]}&action=equipmentUpdated&actorId=${users[1].id}&actorSearch=${suffix}&search=equipment&sort=action&order=asc`,
    ).expect(200);
    expect(response.body.total).toBe(1);
    expect(response.body.data[0]).toMatchObject({
      actorId: users[1].id,
      entityId: equipment[0],
      subject: `HIST-${suffix}-0 · History equipment 0 ${suffix}`,
      details: { changes: { roomId: rooms[1] } },
    });
    expect(JSON.stringify(response.body)).not.toMatch(
      /"passwordHash"|"refreshHash"|"sessions"|"content"/u,
    );
    const event = response.body.data[0];
    const boundary = await api(
      `/audit?entityId=${equipment[0]}&from=${encodeURIComponent(event.createdAt)}&to=${encodeURIComponent(event.createdAt)}`,
    ).expect(200);
    expect(boundary.body.total).toBe(1);
  });

  it('reads legacy account events and remains usable for deleted subjects and blocked authors', async () => {
    const events = await api(`/audit?entityType=account&actorId=${users[0].id}`).expect(200);
    expect(events.body.total).toBe(1);
    expect(events.body.data[0]).toMatchObject({
      entityType: null,
      entityId: null,
      subject: `History 0 ${suffix}`,
      action: 'signedIn',
    });
    const event = await db.auditEntry.create({
      data: {
        actorId: users[0].id,
        action: 'categoryDeleted',
        entityType: 'category',
        entityId: randomUUID(),
      },
    });
    await db.user.update({ where: { id: users[0].id }, data: { isBlocked: true } });
    const deleted = await api(
      `/audit?entityId=${event.entityId}&actorSearch=${encodeURIComponent(`History 0 ${suffix}`)}`,
    ).expect(200);
    expect(deleted.body.total).toBe(1);
    expect(deleted.body.data[0].subject).toBeNull();
    await api('/movements', 0).expect(401);
  });

  it('keeps audit pages disjoint with equal timestamps and supports actor search', async () => {
    const entries = await db.auditEntry.findMany({ where: { actorId: users[1].id } });
    await db.auditEntry.updateMany({
      where: { actorId: users[1].id },
      data: { createdAt: new Date('2026-01-01T00:00:00Z') },
    });
    const collected: string[] = [];
    for (let page = 1; page <= entries.length; page++) {
      const response = await api(
        `/audit?actorId=${users[1].id}&pageSize=1&page=${page}`,
      ).expect(200);
      expect(response.body.total).toBe(entries.length);
      collected.push(response.body.data[0].id as string);
    }
    expect(collected).toEqual(entries.map((entry) => entry.id).sort());
    expect((await api(`/audit?search=${suffix}`).expect(200)).body.total).toBeGreaterThan(0);
  });

  it('rejects invalid queries and does not expose history mutations', async () => {
    for (const path of ['/audit', '/movements']) {
      for (const query of [
        'page=0',
        'pageSize=101',
        'order=sideways',
        'actorId=invalid',
        'from=2026-01-02T00:00:00Z&to=2026-01-01T00:00:00Z',
        'from=not-a-date',
        'unexpected=1',
      ])
        await api(`${path}?${query}`).expect(422);
      await request(app)
        .post(`/api${path}`)
        .auth(users[2].token, { type: 'bearer' })
        .set('Origin', config.CLIENT_ORIGIN)
        .send({})
        .expect(404);
    }
    await api('/movements?sort=reason').expect(422);
    await api('/audit?sort=passwordHash').expect(422);
  });

  it('documents read-only routes and actual response models in OpenAPI', async () => {
    const spec = (await request(app).get('/api/openapi.json').expect(200)).body;
    expect(spec.servers[0].url).toBe('/api');
    expect(spec.paths['/audit'].get.responses['200']).toBeDefined();
    expect(spec.paths['/movements'].get.responses['200']).toBeDefined();
    expect(spec.paths['/movements'].post).toBeUndefined();
    expect(spec.components.schemas.AuditEntry.properties.subject.nullable).toBe(true);
  });
});
