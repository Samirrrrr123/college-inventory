import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import ExcelJS from 'exceljs';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { AuthRepository } from '../src/auth/repository.js';
import { AuthService } from '../src/auth/service.js';
import { ReportingRepository } from '../src/reporting/repository.js';
import { ReportingService } from '../src/reporting/service.js';
import { UserService } from '../src/users/service.js';
import { UserRepository } from '../src/users/repository.js';
import { auditQuery, exportQuery, movementQuery } from '../src/reporting/schemas.js';

const config = loadConfig(process.env);
if (!new URL(config.DATABASE_URL).pathname.endsWith('_test'))
  throw new Error('An isolated _test database is required');
const db = new PrismaClient();
const auth = new AuthService(new AuthRepository(db), config, () => undefined);
const app = createApp(auth, config);
const service = new ReportingService(new ReportingRepository(db));
const suffix = randomUUID();
const password = 'Reporting-test-password';
const users: { id: string; token: string; role: string }[] = [];
const createdUsers: string[] = [];
const rooms: string[] = [];
let categoryId: string;
const api = (method: 'get' | 'post' | 'patch' | 'delete', path: string, index = 3) => {
  const client = request(app);
  return client[method](`/api${path}`)
    .set('Origin', config.CLIENT_ORIGIN)
    .auth(users[index].token, { type: 'bearer' });
};
const actor = (index: number) => ({ id: users[index].id, role: users[index].role });
const equipment = async (extra = {}) =>
  db.equipment.create({
    data: {
      name: `Report ${suffix}`,
      inventoryNumber: randomUUID(),
      categoryId,
      roomId: rooms[0],
      ...extra,
    },
  });

beforeAll(async () => {
  const passwordHash = await bcrypt.hash(password, 4);
  for (const [index, code] of ['teacher', 'teacher', 'technician', 'admin'].entries()) {
    const role = await db.role.upsert({ where: { code }, create: { code }, update: {} });
    const email = `report-${index}-${suffix}@college.test`;
    const user = await db.user.create({
      data: { name: `Report ${index} ${suffix}`, email, passwordHash, roleId: role.id },
    });
    const login = await request(app)
      .post('/api/auth/login')
      .set('Origin', config.CLIENT_ORIGIN)
      .send({ email, password })
      .expect(200);
    users.push({ id: user.id, role: code, token: login.body.data.accessToken as string });
  }
  categoryId = (await db.category.create({ data: { name: `Report ${suffix}` } })).id;
  for (let index = 0; index < 3; index++)
    rooms.push(
      (
        await db.room.create({
          data: {
            number: String(index),
            name: `Room ${index}`,
            building: suffix,
            floor: index,
          },
        })
      ).id,
    );
});
afterAll(async () => {
  const ids = [...users.map((user) => user.id), ...createdUsers];
  await db.loan.deleteMany({ where: { recipientId: { in: ids } } });
  await db.equipmentRequest.deleteMany({ where: { requesterId: { in: ids } } });
  await db.movement.deleteMany({ where: { actorId: { in: ids } } });
  if (categoryId) await db.equipment.deleteMany({ where: { categoryId } });
  await db.auditEntry.deleteMany({ where: { actorId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.room.deleteMany({ where: { id: { in: rooms } } });
  if (categoryId) await db.category.delete({ where: { id: categoryId } });
  await db.$disconnect();
});

describe('Reports, movements and account completion with PostgreSQL', () => {
  it('enforces route permissions and Origin before reading or writing', async () => {
    for (const path of ['/dashboard', '/audit', '/movements', '/equipment/export'])
      await request(app).get(`/api${path}`).expect(401);
    for (const path of ['/audit', '/movements', '/equipment/export', '/users'])
      await api('get', path, 0).expect(403);
    await api('get', '/audit', 2).expect(403);
    await api('post', '/movements', 0).send({}).expect(403);
    await api('post', '/users', 2).send({}).expect(403);
    await request(app)
      .post('/api/movements')
      .auth(users[2].token, { type: 'bearer' })
      .send({})
      .expect(403);
  });

  it('scopes dashboard requests, loans and chart to their owner for teachers', async () => {
    const ownRequest = await db.equipmentRequest.create({
      data: { requesterId: users[0].id, purpose: 'Own' },
    });
    await db.equipmentRequest.create({
      data: { requesterId: users[1].id, purpose: 'Private' },
    });
    const now = new Date();
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const previous = new Date(start.getTime() - 86400000);
    for (const recipient of [0, 1])
      await db.loan.create({
        data: {
          recipientId: users[recipient].id,
          issuedById: users[2].id,
          issuedAt: previous,
          dueAt: previous,
        },
      });
    await db.loan.create({
      data: {
        recipientId: users[0].id,
        issuedById: users[2].id,
        issuedAt: previous,
        dueAt: previous,
        returnedAt: now,
      },
    });
    const mine = (await api('get', '/dashboard', 0).expect(200)).body.data;
    expect(mine).toMatchObject({
      scope: 'own',
      activeLoans: 1,
      overdueLoans: 1,
      pendingRequests: 1,
    });
    expect(mine.loansByDay).toHaveLength(7);
    expect(
      mine.loansByDay.slice(0, 5).every((day: { count: number }) => day.count === 0),
    ).toBe(true);
    expect(mine.loansByDay[5]).toEqual({
      date: previous.toISOString().slice(0, 10),
      count: 2,
    });
    const all = (await api('get', '/dashboard', 2).expect(200)).body.data;
    expect(all).toMatchObject({
      scope: 'all',
      activeLoans: 2,
      overdueLoans: 2,
      pendingRequests: 2,
    });
    expect(all.totalEquipment).toBe(await db.equipment.count());
    expect(all.equipmentByStatus).toHaveProperty('written_off');
    expect(mine.totalEquipment).toBe(all.totalEquipment);
    await db.equipmentRequest.update({
      where: { id: ownRequest.id },
      data: { status: 'cancelled' },
    });
    await api('get', '/dashboard?recipientId=anything', 0).expect(422);
    expect(JSON.stringify(mine)).not.toMatch(/Private|email|password/iu);
  });

  it('moves equipment with atomic history and audit, including search and pagination', async () => {
    const item = await equipment();
    const response = await api('post', '/movements', 2)
      .send({
        equipmentId: item.id,
        toRoomId: rooms[1],
        expectedFromRoomId: rooms[0],
        reason: 'Перенос для занятия',
      })
      .expect(201);
    expect(response.body.data).toMatchObject({
      equipmentId: item.id,
      fromRoomId: rooms[0],
      toRoomId: rooms[1],
      actorId: users[2].id,
    });
    expect(response.body.data.actor.name).toContain('Report 2');
    expect((await db.equipment.findUniqueOrThrow({ where: { id: item.id } })).roomId).toBe(
      rooms[1],
    );
    const audit = await db.auditEntry.findFirstOrThrow({
      where: { action: 'equipmentMoved', entityId: response.body.data.id },
    });
    expect(audit.details).toMatchObject({
      equipmentId: item.id,
      fromRoomId: rooms[0],
      toRoomId: rooms[1],
    });
    await api('patch', `/equipment/${item.id}`, 2).send({ roomId: rooms[2] }).expect(200);
    const list = await api(
      'get',
      `/movements?equipmentId=${item.id}&search=${encodeURIComponent(item.inventoryNumber)}&pageSize=1&page=2&order=asc`,
    ).expect(200);
    expect(list.body.total).toBe(2);
    expect(list.body.data[0].toRoomId).toBe(rooms[2]);
    const filtered = await api(
      'get',
      `/movements?equipmentId=${item.id}&fromRoomId=${rooms[0]}&toRoomId=${rooms[1]}&actorId=${users[2].id}&from=${encodeURIComponent(item.createdAt.toISOString())}`,
    ).expect(200);
    expect(filtered.body.total).toBe(1);
    await api('delete', `/equipment/${item.id}`).expect(409);
  });

  it('rejects stale, invalid or prohibited moves without partial changes', async () => {
    const item = await equipment();
    const input = { equipmentId: item.id, toRoomId: rooms[1], reason: 'Move' };
    await api('post', '/movements')
      .send({ ...input, expectedFromRoomId: rooms[2] })
      .expect(409);
    await api('post', '/movements')
      .send({ ...input, toRoomId: rooms[0] })
      .expect(409);
    await api('post', '/movements')
      .send({ ...input, toRoomId: randomUUID() })
      .expect(404);
    await api('post', '/movements')
      .send({ ...input, equipmentId: randomUUID() })
      .expect(404);
    for (const status of ['issued'] as const) {
      await db.equipment.update({ where: { id: item.id }, data: { status } });
      await api('post', '/movements').send(input).expect(409);
    }
    await api('post', '/movements')
      .send({ ...input, reason: '' })
      .expect(422);
    expect(await db.movement.count({ where: { equipmentId: item.id } })).toBe(0);
    expect((await db.equipment.findUniqueOrThrow({ where: { id: item.id } })).roomId).toBe(
      rooms[0],
    );
  });

  it('accepts one of two concurrent moves from the same expected room', async () => {
    const item = await equipment();
    const responses = await Promise.all(
      [rooms[1], rooms[2]].map((toRoomId) =>
        api('post', '/movements', 2).send({
          equipmentId: item.id,
          toRoomId,
          expectedFromRoomId: rooms[0],
          reason: 'Concurrent move',
        }),
      ),
    );
    expect(responses.map((result) => result.status).sort()).toEqual([201, 409]);
    const moves = await db.movement.findMany({ where: { equipmentId: item.id } });
    expect(moves).toHaveLength(1);
    expect((await db.equipment.findUniqueOrThrow({ where: { id: item.id } })).roomId).toBe(
      moves[0].toRoomId,
    );
  });

  it('filters global audit without revealing account credentials', async () => {
    const event = await db.auditEntry.create({
      data: {
        actorId: users[2].id,
        action: `test${suffix}`,
        entityType: 'equipment',
        entityId: randomUUID(),
        details: { changed: 'roomId' },
      },
    });
    await db.auditEntry.create({
      data: { actorId: users[3].id, action: `test${suffix}`, entityType: 'equipment' },
    });
    const query = `search=${suffix}&action=${event.action}&entityType=equipment&entityId=${event.entityId}&actorId=${users[2].id}&sort=action&order=asc&from=${encodeURIComponent(event.createdAt.toISOString())}&to=${encodeURIComponent(event.createdAt.toISOString())}`;
    const response = await api('get', `/audit?${query}`).expect(200);
    expect(response.body.total).toBe(1);
    expect(response.body.data[0].actor.id).toBe(users[2].id);
    expect(response.body.data[0].details).toEqual({ changed: 'roomId' });
    expect(JSON.stringify(response.body)).not.toMatch(/password|token|session|refresh/iu);
    const page = await api(
      'get',
      `/audit?search=${suffix}&pageSize=1&page=2&sort=action`,
    ).expect(200);
    expect(page.body.total).toBeGreaterThanOrEqual(2);
    expect(page.body.data).toHaveLength(1);
    await api('get', '/audit?from=2026-01-02T00:00:00Z&to=2026-01-01T00:00:00Z').expect(422);
    await api('get', '/movements?sort=reason').expect(422);
    await api('get', '/audit?pageSize=101').expect(422);
    await api('get', '/audit?sort=passwordHash').expect(422);
  });

  it('exports a genuine XLSX with matching filters, safe strings and no pagination truncation', async () => {
    const name = '=HYPERLINK("https://example.invalid","unsafe")';
    const item = await equipment({ name, description: '+SUM(1,1)', serialNumber: '@SUM(A1)' });
    const response = await api(
      'get',
      `/equipment/export?search=${encodeURIComponent(item.inventoryNumber)}&categoryId=${categoryId}&roomId=${rooms[0]}&status=available&sort=inventoryNumber&order=desc`,
      2,
    )
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => callback(null, Buffer.concat(chunks)));
        res.on('error', callback);
      })
      .expect(200);
    expect(response.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(response.headers['content-disposition']).toMatch(
      /equipment-\d{4}-\d{2}-\d{2}\.xlsx/u,
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(response.body);
    const sheet = workbook.worksheets[0];
    expect(sheet.rowCount).toBe(2);
    expect(sheet.getCell('A2').text).toBe(item.inventoryNumber);
    expect(sheet.getCell('B2').value).toBe(name);
    expect(sheet.getCell('B2').type).toBe(ExcelJS.ValueType.String);
    expect(sheet.getCell('G2').value).toBe('@SUM(A1)');
    expect(sheet.getCell('H2').value).toBe('+SUM(1,1)');
    const audit = await db.auditEntry.findFirstOrThrow({
      where: { actorId: users[2].id, action: 'equipmentExported' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit.details).toMatchObject({ rows: 1 });
    await api('get', '/equipment/export?page=1').expect(422);
    await api('get', '/equipment/export?sort=passwordHash').expect(422);
  });

  it('produces a valid empty workbook and refuses oversized exports', async () => {
    const content = await service.exportEquipment(
      exportQuery.parse({ search: randomUUID() }),
      actor(2),
    );
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(content as unknown as ExcelJS.Buffer);
    expect(workbook.worksheets[0].rowCount).toBe(1);
    const prefix = `bulk-${suffix}`;
    await db.equipment.createMany({
      data: Array.from({ length: 5001 }, (_, index) => ({
        name: prefix,
        inventoryNumber: `${prefix}-${index}`,
        categoryId,
        roomId: rooms[0],
      })),
    });
    const before = await db.auditEntry.count({
      where: { action: 'equipmentExported', actorId: users[3].id },
    });
    const response = await api('get', `/equipment/export?search=${prefix}`).expect(422);
    expect(response.body.error.code).toBe('EXPORT_TOO_LARGE');
    expect(
      await db.auditEntry.count({
        where: { action: 'equipmentExported', actorId: users[3].id },
      }),
    ).toBe(before);
    await db.equipment.deleteMany({ where: { name: prefix } });
  });

  it('protects business services when invoked without HTTP routing', async () => {
    const teacher = actor(0);
    await expect(service.audit(auditQuery.parse({}), teacher)).rejects.toMatchObject({
      status: 403,
    });
    await expect(service.movements(movementQuery.parse({}), teacher)).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      service.exportEquipment(exportQuery.parse({}), teacher),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.move({ equipmentId: randomUUID(), toRoomId: rooms[1], reason: 'x' }, teacher),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('creates accounts securely and edits profile with session revocation', async () => {
    const email = `created-${suffix}@college.test`;
    const input = {
      name: 'Созданный пользователь',
      email: email.toUpperCase(),
      password,
      role: 'technician',
    };
    const created = await api('post', '/users').send(input).expect(201);
    const id = created.body.data.id as string;
    createdUsers.push(id);
    expect(created.body.data).toMatchObject({
      email,
      role: 'technician',
      isBlocked: false,
      isLastAdmin: false,
    });
    expect(JSON.stringify(created.body)).not.toMatch(/password|session|refresh/iu);
    expect(
      await bcrypt.compare(
        password,
        (await db.user.findUniqueOrThrow({ where: { id } })).passwordHash,
      ),
    ).toBe(true);
    await api('post', '/users').send(input).expect(409);
    const logged = await request(app)
      .post('/api/auth/login')
      .set('Origin', config.CLIENT_ORIGIN)
      .send({ email, password })
      .expect(200);
    await api('get', `/users/${id}`).expect(200);
    await api('get', `/users/${id}`, 0).expect(403);
    await api('get', `/users/${randomUUID()}`).expect(404);
    const changed = await api('patch', `/users/${id}`)
      .send({ name: 'Новое имя', email: `edited-${suffix}@college.test` })
      .expect(200);
    expect(changed.body.data.name).toBe('Новое имя');
    await request(app)
      .get('/api/me')
      .auth(logged.body.data.accessToken, { type: 'bearer' })
      .expect(401);
    const audit = await db.auditEntry.findFirstOrThrow({
      where: { entityId: id, action: 'userCreated' },
    });
    expect(JSON.stringify(audit)).not.toMatch(/password|token/iu);
    await api('post', '/users')
      .send({ ...input, email: `bad-${suffix}@college.test`, role: 'owner' })
      .expect(422);
    await api('post', '/users')
      .send({ ...input, email: `bad-${suffix}@college.test`, password: 'я'.repeat(40) })
      .expect(422);
    await api('patch', `/users/${id}`).send({ email: 'bad' }).expect(422);
  });

  it('serializes a move racing with equipment issuance without moving already issued units', async () => {
    const item = await equipment();
    const [moved, issued] = await Promise.all([
      api('post', '/movements', 2).send({
        equipmentId: item.id,
        toRoomId: rooms[1],
        expectedFromRoomId: rooms[0],
        reason: 'Move racing with issue',
      }),
      api('post', '/loans', 2).send({
        kind: 'direct',
        recipientId: users[0].id,
        equipmentIds: [item.id],
        dueAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    ]);
    expect(issued.status).toBe(201);
    expect([201, 409]).toContain(moved.status);
    const saved = await db.equipment.findUniqueOrThrow({ where: { id: item.id } });
    expect(saved.status).toBe('issued');
    expect(saved.roomId).toBe(moved.status === 201 ? rooms[1] : rooms[0]);
    expect(await db.movement.count({ where: { equipmentId: item.id } })).toBe(
      moved.status === 201 ? 1 : 0,
    );
    await api('post', `/loans/${issued.body.data.id}/return`, 2).send({}).expect(200);
  });

  it('rechecks the creating administrator in the database and protects user services directly', async () => {
    const userService = new UserService(new UserRepository(db));
    const input = {
      name: 'Denied account',
      email: `denied-${suffix}@college.test`,
      password,
      role: 'teacher' as const,
      isBlocked: false,
    };
    await expect(userService.create(input, actor(0))).rejects.toMatchObject({ status: 403 });
    await expect(userService.detail(users[0].id, actor(0))).rejects.toMatchObject({
      status: 403,
    });
    await expect(
      userService.create(input, { id: users[0].id, role: 'admin' }),
    ).rejects.toMatchObject({ status: 403 });
    expect(await db.user.count({ where: { email: input.email } })).toBe(0);
  });

  it('documents new API paths, response schemas and binary export', async () => {
    const spec = (await request(app).get('/api/openapi.json').expect(200)).body;
    for (const path of ['/dashboard', '/audit', '/movements', '/equipment/export'])
      expect(spec.paths[path]).toBeDefined();
    expect(spec.paths['/users'].post.responses['201']).toBeDefined();
    expect(spec.paths['/users/{id}'].get.responses['200']).toBeDefined();
    expect(
      spec.paths['/equipment/export'].get.responses['200'].content[
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ].schema.format,
    ).toBe('binary');
    expect(spec.components.schemas.Dashboard.required).toContain('loansByDay');
  });
});
