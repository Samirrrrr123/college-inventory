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
const password = 'Circulation-test-password';
const users: { id: string; token: string }[] = [];
let categoryId: string;
let roomId: string;
const api = (method: 'get' | 'post' | 'delete', path: string, index = 0) => {
  const client = request(app);
  return client[method](`/api${path}`)
    .set('Origin', config.CLIENT_ORIGIN)
    .auth(users[index].token, { type: 'bearer' });
};
const future = () => new Date(Date.now() + 86400000).toISOString();
async function equipment(count = 2) {
  const result: string[] = [];
  for (let index = 0; index < count; index++) {
    const item = await db.equipment.create({
      data: {
        name: `Circulation ${suffix}`,
        inventoryNumber: randomUUID(),
        categoryId,
        roomId,
      },
    });
    result.push(item.id);
  }
  return result;
}
async function create(ids: string[], index = 0, purpose = `Class ${suffix}`) {
  return api('post', '/requests', index).send({ purpose, equipmentIds: ids }).expect(201);
}
async function approve(id: string) {
  return api('post', `/requests/${id}/approve`, 2)
    .send({ note: 'Ready for issue' })
    .expect(200);
}
beforeAll(async () => {
  const passwordHash = await bcrypt.hash(password, 4);
  for (const [index, code] of ['teacher', 'teacher', 'technician', 'admin'].entries()) {
    const role = await db.role.upsert({ where: { code }, create: { code }, update: {} });
    const email = `circulation-${index}-${suffix}@college.test`;
    const user = await db.user.create({
      data: { name: `Circulation ${index}`, email, passwordHash, roleId: role.id },
    });
    const login = await request(app)
      .post('/api/auth/login')
      .set('Origin', config.CLIENT_ORIGIN)
      .send({ email, password })
      .expect(200);
    users.push({ id: user.id, token: login.body.data.accessToken as string });
  }
  categoryId = (await db.category.create({ data: { name: `Circulation ${suffix}` } })).id;
  roomId = (
    await db.room.create({
      data: {
        number: suffix.slice(0, 20),
        name: 'Circulation room',
        building: suffix,
        floor: 0,
      },
    })
  ).id;
});
afterAll(async () => {
  const ids = users.map((user) => user.id);
  const loans = await db.loan.findMany({
    where: { recipientId: { in: ids } },
    select: { id: true },
  });
  const requests = await db.equipmentRequest.findMany({
    where: { requesterId: { in: ids } },
    select: { id: true },
  });
  await db.loanItem.deleteMany({ where: { loanId: { in: loans.map((loan) => loan.id) } } });
  await db.loan.deleteMany({ where: { id: { in: loans.map((loan) => loan.id) } } });
  await db.requestItem.deleteMany({
    where: { requestId: { in: requests.map((item) => item.id) } },
  });
  await db.equipmentRequest.deleteMany({ where: { requesterId: { in: ids } } });
  if (categoryId) await db.equipment.deleteMany({ where: { categoryId } });
  await db.auditEntry.deleteMany({ where: { actorId: { in: ids } } });
  if (categoryId) await db.category.delete({ where: { id: categoryId } });
  if (roomId) await db.room.delete({ where: { id: roomId } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});

describe('Requests and loans with PostgreSQL', () => {
  it('validates sets, assigns the real author and protects foreign requests and staff actions', async () => {
    const ids = await equipment();
    for (const equipmentIds of [
      [],
      [ids[0], ids[0].toUpperCase()],
      Array.from({ length: 21 }, () => randomUUID()),
    ]) {
      await api('post', '/requests').send({ purpose: 'Class', equipmentIds }).expect(422);
    }
    await api('post', '/requests')
      .send({ purpose: 'Class', equipmentIds: ids, requesterId: users[1].id })
      .expect(422);
    const created = await create(ids);
    expect(created.body.data.requesterId).toBe(users[0].id);
    expect(created.body.data.items).toHaveLength(2);
    expect(JSON.stringify(created.body)).not.toContain('password');
    await api('get', `/requests/${created.body.data.id}`, 1).expect(404);
    await api('post', `/requests/${created.body.data.id}/approve`).send({}).expect(403);
    await api('get', '/loan-recipients').expect(403);
    await api('post', '/loans')
      .send({ kind: 'direct', recipientId: users[0].id, equipmentIds: ids, dueAt: future() })
      .expect(403);
    await request(app).get('/api/requests').expect(401);
    await api('get', '/requests/not-a-uuid').expect(422);
    await api('get', `/requests/${randomUUID()}`).expect(404);
    await api('get', `/loans/${randomUUID()}`).expect(404);
    const other = await api('get', `/requests?search=${suffix}`, 1).expect(200);
    expect(other.body.total).toBe(0);
  });

  it('issues and returns a whole approved set and preserves history and audit', async () => {
    const ids = await equipment();
    const created = await create(ids);
    const id = created.body.data.id as string;
    await api('post', '/loans', 2)
      .send({ kind: 'request', requestId: id, dueAt: future() })
      .expect(409);
    await approve(id);
    expect(await db.equipment.count({ where: { id: { in: ids }, status: 'available' } })).toBe(
      2,
    );
    await api('post', `/requests/${id}/reject`, 2).send({}).expect(409);
    const issued = await api('post', '/loans', 2)
      .send({ kind: 'request', requestId: id, dueAt: future() })
      .expect(201);
    const loanId = issued.body.data.id as string;
    expect(issued.body.data.items).toHaveLength(2);
    expect(await db.equipment.count({ where: { id: { in: ids }, status: 'issued' } })).toBe(2);
    await api('get', `/loans/${loanId}`).expect(200);
    await api('get', `/loans/${loanId}`, 1).expect(404);
    await api('post', '/loans', 2)
      .send({ kind: 'request', requestId: id, dueAt: future() })
      .expect(409);
    await api('post', `/requests/${id}/cancel`).send({}).expect(409);
    await api('post', `/loans/${loanId}/return`).send({}).expect(403);
    const returned = await api('post', `/loans/${loanId}/return`, 3).send({}).expect(200);
    expect(returned.body.data.returnedById).toBe(users[3].id);
    expect(await db.equipment.count({ where: { id: { in: ids }, status: 'available' } })).toBe(
      2,
    );
    await api('post', `/loans/${loanId}/return`, 2).send({}).expect(409);
    await api('delete', `/equipment/${ids[0]}`, 2).expect(409);
    const actions = await db.auditEntry.findMany({
      where: { entityId: { in: [id, loanId] } },
      select: { action: true },
    });
    expect(actions.map((entry) => entry.action).sort()).toEqual([
      'loanIssued',
      'loanReturned',
      'requestApproved',
      'requestCreated',
    ]);
  });

  it('rolls back every item when one member of an approved set is already issued', async () => {
    const [busy, free] = await equipment();
    const created = await create([busy, free]);
    await approve(created.body.data.id as string);
    const direct = await api('post', '/loans', 2)
      .send({
        kind: 'direct',
        recipientId: users[1].id,
        equipmentIds: [busy],
        dueAt: future(),
      })
      .expect(201);
    const denied = await api('post', '/loans', 2)
      .send({ kind: 'request', requestId: created.body.data.id, dueAt: future() })
      .expect(409);
    expect(denied.body.error.code).toBe('EQUIPMENT_UNAVAILABLE');
    expect((await db.equipment.findUniqueOrThrow({ where: { id: free } })).status).toBe(
      'available',
    );
    expect(await db.loan.count({ where: { requestId: created.body.data.id } })).toBe(0);
    await api('post', `/loans/${direct.body.data.id}/return`, 2).send({}).expect(200);
    await api('post', '/loans', 2)
      .send({ kind: 'request', requestId: created.body.data.id, dueAt: future() })
      .expect(201);
  });

  it('allows exactly one concurrent issue and one concurrent return', async () => {
    const ids = await equipment();
    const body = {
      kind: 'direct',
      recipientId: users[0].id,
      equipmentIds: ids,
      dueAt: future(),
    };
    const issued = await Promise.all([
      api('post', '/loans', 2).send(body),
      api('post', '/loans', 3).send(body),
    ]);
    expect(issued.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(await db.loanItem.count({ where: { equipmentId: { in: ids } } })).toBe(2);
    const loanId = issued.find((result) => result.status === 201)!.body.data.id as string;
    const returned = await Promise.all([
      api('post', `/loans/${loanId}/return`, 2).send({}),
      api('post', `/loans/${loanId}/return`, 3).send({}),
    ]);
    expect(returned.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(await db.equipment.count({ where: { id: { in: ids }, status: 'available' } })).toBe(
      2,
    );
    expect(
      await db.auditEntry.count({ where: { entityId: loanId, action: 'loanReturned' } }),
    ).toBe(1);
  });

  it('enforces cancellations, rejection, blocked recipients and future deadlines', async () => {
    const ids = await equipment();
    const created = await create(ids);
    await api('post', `/requests/${created.body.data.id}/cancel`, 1).send({}).expect(404);
    await api('post', `/requests/${created.body.data.id}/cancel`).send({}).expect(200);
    await api('post', `/requests/${created.body.data.id}/approve`, 2).send({}).expect(409);
    const rejected = await create(ids);
    await api('post', `/requests/${rejected.body.data.id}/reject`, 3)
      .send({ note: 'Not for this class' })
      .expect(200);
    await api('post', `/requests/${rejected.body.data.id}/cancel`).send({}).expect(409);
    const approved = await create(ids);
    await approve(approved.body.data.id as string);
    await api('post', `/requests/${approved.body.data.id}/cancel`).send({}).expect(200);
    const body = {
      kind: 'direct',
      recipientId: users[1].id,
      equipmentIds: ids,
      dueAt: future(),
    };
    await api('post', '/loans', 2)
      .send({ ...body, dueAt: new Date(Date.now() - 1000).toISOString() })
      .expect(422);
    await db.user.update({ where: { id: users[1].id }, data: { isBlocked: true } });
    await api('post', '/loans', 2).send(body).expect(409);
    await db.user.update({ where: { id: users[1].id }, data: { isBlocked: false } });
    await api('post', '/loans', 2)
      .send({ ...body, equipmentIds: [randomUUID(), ids[0]] })
      .expect(409);
    expect(await db.equipment.count({ where: { id: { in: ids }, status: 'available' } })).toBe(
      2,
    );
    await db.equipment.update({ where: { id: ids[0] }, data: { status: 'repair' } });
    await api('post', '/requests')
      .send({ equipmentIds: ids, purpose: 'Repair unavailable' })
      .expect(409);
  });

  it('executes search, paging, sorting and overdue filters on the server', async () => {
    const ids = await equipment(1);
    const purpose = `Paging ${randomUUID()}`;
    const one = await create(ids, 0, purpose);
    const two = await create(ids, 0, purpose);
    const query = `search=${encodeURIComponent(purpose)}&sort=number&order=desc&pageSize=1&page=2`;
    const list = await api('get', `/requests?${query}`).expect(200);
    expect(list.body.total).toBe(2);
    expect(list.body.data[0].id).toBe(one.body.data.id);
    await approve(two.body.data.id as string);
    const issued = await api('post', '/loans', 2)
      .send({ kind: 'request', requestId: two.body.data.id, dueAt: future() })
      .expect(201);
    await db.loan.update({
      where: { id: issued.body.data.id },
      data: { dueAt: new Date(Date.now() - 1000) },
    });
    const overdue = await api(
      'get',
      `/loans?status=overdue&search=${suffix}&sort=dueAt&order=asc&pageSize=1`,
    ).expect(200);
    expect(overdue.body.data[0].id).toBe(issued.body.data.id);
    const foreign = await api('get', `/loans?status=overdue&search=${suffix}`, 1).expect(200);
    expect(foreign.body.total).toBe(0);
    const recipients = await api(
      'get',
      `/loan-recipients?search=${suffix}&pageSize=1&page=2`,
      2,
    ).expect(200);
    expect(recipients.body.total).toBe(4);
    expect(recipients.body.data).toHaveLength(1);
    expect(JSON.stringify(recipients.body)).not.toContain('password');
    await api('get', '/requests?sort=purpose').expect(422);
    await api('get', '/loans?pageSize=101').expect(422);
  });
});
