import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { AuthRepository } from '../src/auth/repository.js';
import { AuthService } from '../src/auth/service.js';
import { UserRepository } from '../src/users/repository.js';
import { UserService } from '../src/users/service.js';

const config = loadConfig(process.env);
if (!new URL(config.DATABASE_URL).pathname.endsWith('_test'))
  throw new Error('An isolated _test database is required');
const db = new PrismaClient();
const app = createApp(
  new AuthService(new AuthRepository(db), config, () => undefined),
  config,
);
const suffix = randomUUID();
const password = 'User-administration-test';
const users: { id: string; email: string; token: string; cookie: string; role: string }[] = [];
const login = (email: string) =>
  request(app)
    .post('/api/auth/login')
    .set('Origin', config.CLIENT_ORIGIN)
    .send({ email, password });
const api = (method: 'get' | 'patch', path: string, index = 0) => {
  const client = request(app);
  return client[method](`/api${path}`)
    .set('Origin', config.CLIENT_ORIGIN)
    .auth(users[index].token, { type: 'bearer' });
};
const patch = (index: number, body: object, actor = 0) =>
  api('patch', `/users/${users[index].id}`, actor).send(body);
beforeAll(async () => {
  if (await db.user.count({ where: { role: { code: 'admin' }, isBlocked: false } }))
    throw new Error(
      'Last-admin tests need a test database without existing active administrators',
    );
  const passwordHash = await bcrypt.hash(password, 4);
  for (const [index, code] of ['admin', 'admin', 'technician', 'teacher'].entries()) {
    const role = await db.role.upsert({ where: { code }, create: { code }, update: {} });
    const email = `users-${index}-${suffix}@college.test`;
    const user = await db.user.create({
      data: { name: `Users ${index} ${suffix}`, email, passwordHash, roleId: role.id },
    });
    users.push({ id: user.id, email, token: '', cookie: '', role: code });
  }
});
beforeEach(async () => {
  for (const user of users) {
    await db.user.update({
      where: { id: user.id },
      data: { isBlocked: false, role: { connect: { code: user.role } } },
    });
    await db.session.deleteMany({ where: { userId: user.id } });
    const response = await login(user.email).expect(200);
    user.token = response.body.data.accessToken as string;
    user.cookie = String(response.headers['set-cookie'][0]).split(';')[0];
  }
});
afterAll(async () => {
  const ids = users.map((user) => user.id);
  await db.auditEntry.deleteMany({ where: { actorId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});

describe('User administration with PostgreSQL', () => {
  it('requires admin rights and rejects unknown or invalid patch fields', async () => {
    await request(app).get('/api/users').expect(401);
    for (const role of [2, 3]) {
      await api('get', '/users', role).expect(403);
      await patch(3, { role: 'admin' }, role).expect(403);
    }
    for (const body of [
      {},
      { role: 'owner' },
      { isBlocked: 'false' },
      { name: 'x' },
      { passwordHash: 'fake' },
      { roleId: randomUUID() },
    ])
      await patch(3, body).expect(422);
    await api('patch', `/users/${randomUUID()}`).send({ role: 'teacher' }).expect(404);
    await api('get', '/users?sort=passwordHash').expect(422);
  });

  it('filters and pages on the server and computes last-admin protection across filters', async () => {
    await patch(3, { isBlocked: true }).expect(200);
    const list = await api(
      'get',
      `/users?search=${suffix}&status=active&sort=email&order=desc&pageSize=1&page=2`,
    ).expect(200);
    expect(list.body.total).toBe(3);
    expect(list.body.data[0].email).toBe(users[1].email);
    expect(JSON.stringify(list.body)).not.toMatch(/password|session|refresh/iu);
    await patch(1, { role: 'teacher' }).expect(200);
    const filtered = await api(
      'get',
      `/users?search=${encodeURIComponent(users[0].email)}&role=admin`,
    ).expect(200);
    expect(filtered.body.data[0].isLastAdmin).toBe(true);
    const blocked = await api('get', `/users?search=${suffix}&status=blocked`).expect(200);
    expect(blocked.body.data).toHaveLength(1);
    expect(blocked.body.data[0].id).toBe(users[3].id);
  });

  it('changes the role, closes all sessions and records the actor without secrets', async () => {
    await login(users[3].email).expect(200);
    const before = await db.auditEntry.count({
      where: { action: 'userAccessChanged', entityId: users[3].id },
    });
    const changed = await patch(3, { role: 'technician' }).expect(200);
    expect(changed.body.data.role).toBe('technician');
    expect(changed.body.data).not.toHaveProperty('passwordHash');
    expect(await db.session.count({ where: { userId: users[3].id } })).toBe(0);
    await api('get', '/me', 3).expect(401);
    const fresh = await login(users[3].email).expect(200);
    const me = await request(app)
      .get('/api/me')
      .auth(fresh.body.data.accessToken as string, { type: 'bearer' })
      .expect(200);
    expect(me.body.data.role).toBe('technician');
    const entry = await db.auditEntry.findFirstOrThrow({
      where: { action: 'userAccessChanged', entityId: users[3].id },
      orderBy: { createdAt: 'desc' },
    });
    expect(entry.actorId).toBe(users[0].id);
    expect(entry.details).toMatchObject({
      before: { role: 'teacher' },
      after: { role: 'technician' },
    });
    await patch(3, { role: 'technician' }).expect(200);
    expect(
      await db.auditEntry.count({
        where: { action: 'userAccessChanged', entityId: users[3].id },
      }),
    ).toBe(before + 1);
    expect(await db.session.count({ where: { userId: users[3].id } })).toBe(1);
  });

  it('blocks login, revokes refresh and reset codes and does not restore old sessions on unblock', async () => {
    await db.passwordReset.create({
      data: {
        userId: users[3].id,
        tokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + 60000),
      },
    });
    await patch(3, { isBlocked: true }).expect(200);
    await api('get', '/me', 3).expect(401);
    await login(users[3].email).expect(401);
    const refresh = () =>
      request(app)
        .post('/api/auth/refresh')
        .set('Origin', config.CLIENT_ORIGIN)
        .set('Cookie', users[3].cookie);
    await refresh().expect(401);
    expect(await db.passwordReset.count({ where: { userId: users[3].id } })).toBe(0);
    await patch(3, { isBlocked: false }).expect(200);
    await refresh().expect(401);
    await api('get', '/me', 3).expect(401);
    await login(users[3].email).expect(200);
  });

  it('protects the last active administrator from blocking and role changes', async () => {
    await patch(1, { isBlocked: true }).expect(200);
    const before = await db.auditEntry.count({
      where: { action: 'userAccessChanged', entityId: users[0].id },
    });
    for (const body of [
      { role: 'teacher' },
      { isBlocked: true },
      { role: 'technician', isBlocked: true },
    ]) {
      const response = await patch(0, body).expect(409);
      expect(response.body.error.code).toBe('LAST_ADMIN');
    }
    expect(
      await db.auditEntry.count({
        where: { action: 'userAccessChanged', entityId: users[0].id },
      }),
    ).toBe(before);
    await api('get', '/users').expect(200);
  });

  it('retains one active administrator under concurrent changes', async () => {
    const results = await Promise.all([
      patch(0, { isBlocked: true }),
      patch(1, { role: 'teacher' }, 1),
    ]);
    expect(results.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(results.find((response) => response.status === 409)?.body.error.code).toBe(
      'LAST_ADMIN',
    );
    expect(await db.user.count({ where: { isBlocked: false, role: { code: 'admin' } } })).toBe(
      1,
    );
  });

  it('checks the current actor again inside the write transaction', async () => {
    const service = new UserService(new UserRepository(db));
    await expect(
      service.list(
        { search: '', page: 1, pageSize: 20, sort: 'name', order: 'asc' },
        { id: users[2].id, role: 'technician' },
      ),
    ).rejects.toMatchObject({ status: 403 });
    await patch(1, { role: 'teacher' }).expect(200);
    await expect(
      service.update(users[3].id, { role: 'admin' }, { id: users[1].id, role: 'admin' }),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      (
        await db.user.findUniqueOrThrow({
          where: { id: users[3].id },
          include: { role: true },
        })
      ).role.code,
    ).toBe('teacher');
  });

  it('describes real API URLs without repeating the /api prefix', async () => {
    const spec = (await request(app).get('/api/openapi.json').expect(200)).body;
    expect(spec.servers[0].url).toBe('/api');
    expect(Object.keys(spec.paths).every((path) => !path.startsWith('/api/'))).toBe(true);
    for (const path of [
      '/requests',
      '/loans',
      '/inventory-checks',
      '/equipment/{equipmentId}/files',
      '/users/{id}',
    ])
      expect(spec.paths[path]).toBeDefined();
    expect(
      spec.paths['/users/{id}'].patch.requestBody.content['application/json'].schema
        .additionalProperties,
    ).toBe(false);
    await request(app)
      .get(`${spec.servers[0].url}/users`)
      .auth(users[0].token, { type: 'bearer' })
      .expect(200);
  });
});
