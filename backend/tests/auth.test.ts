import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { AuthRepository } from '../src/auth/repository.js';
import { AuthService } from '../src/auth/service.js';

const database = process.env.DATABASE_URL;
if (!database || !new URL(database).pathname.endsWith('_test'))
  throw new Error('Tests require an isolated PostgreSQL database ending in _test');
const config = loadConfig(process.env);
const db = new PrismaClient();
const resetLinks: string[] = [];
const service = new AuthService(new AuthRepository(db), config, (url) => resetLinks.push(url));
const app = createApp(service, config);
const suffix = randomUUID();
const password = 'Practice-Password-2026';
const email = (name: string) => `${name}-${suffix}@college.test`;
const post = (path: string) =>
  request(app).post(`/api${path}`).set('Origin', config.CLIENT_ORIGIN);
const patch = (path: string, token: string) =>
  request(app)
    .patch(`/api${path}`)
    .set('Origin', config.CLIENT_ORIGIN)
    .auth(token, { type: 'bearer' });
const get = (path: string, token: string) =>
  request(app).get(`/api${path}`).auth(token, { type: 'bearer' });
const cookie = (response: request.Response) =>
  String(response.headers['set-cookie'][0]).split(';')[0];
async function account(name: string, role = 'teacher') {
  const created = await post('/auth/register')
    .send({ name, email: email(name), password })
    .expect(201);
  if (role !== 'teacher')
    await db.user.update({
      where: { id: created.body.data.id },
      data: { role: { connect: { code: role } } },
    });
  const login = await post('/auth/login')
    .send({ email: email(name), password })
    .expect(200);
  return {
    id: created.body.data.id as string,
    access: login.body.data.accessToken as string,
    cookie: cookie(login),
  };
}
beforeAll(async () => {
  await db.$connect();
});
afterAll(async () => {
  const users = await db.user.findMany({
    where: { email: { contains: suffix } },
    select: { id: true },
  });
  const ids = users.map((user) => user.id);
  await db.auditEntry.deleteMany({ where: { actorId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});

describe('Accounts API with PostgreSQL', () => {
  it('stores a password hash, normalizes email and never accepts a role from registration', async () => {
    await post('/auth/register')
      .send({ name: 'Tamper', email: email('tamper'), password, role: 'admin' })
      .expect(422);
    const result = await post('/auth/register')
      .send({ name: 'First', email: email('First').toUpperCase(), password })
      .expect(201);
    expect(result.body.data.role).toBe('teacher');
    expect(JSON.stringify(result.body)).not.toContain('password');
    const stored = await db.user.findUniqueOrThrow({ where: { id: result.body.data.id } });
    expect(stored.passwordHash).toMatch(/^\$2[ab]\$12\$/u);
    expect(stored.email).toBe(email('first'));
    await post('/auth/register')
      .send({ name: 'Duplicate', email: email('first'), password })
      .expect(409);
    await post('/auth/register')
      .send({ name: 'Short', email: email('short'), password: '123' })
      .expect(422);
    await post('/auth/register')
      .send({ name: 'Bytes', email: email('bytes'), password: 'я'.repeat(40) })
      .expect(422);
  });
  it('returns identical failures for a wrong password, missing account and blocked user', async () => {
    const user = await account('blocked');
    const wrong = await post('/auth/login')
      .send({ email: email('blocked'), password: 'wrong' })
      .expect(401);
    const missing = await post('/auth/login')
      .send({ email: email('missing'), password })
      .expect(401);
    await db.user.update({ where: { id: user.id }, data: { isBlocked: true } });
    const blocked = await post('/auth/login')
      .send({ email: email('blocked'), password })
      .expect(401);
    expect(wrong.body).toEqual(missing.body);
    expect(wrong.body).toEqual(blocked.body);
    await get('/me', user.access).expect(401);
    await post('/auth/refresh').set('Cookie', user.cookie).expect(401);
  });
  it('rotates refresh JWT once, stores only its hash and revokes access on logout', async () => {
    const user = await account('rotation');
    expect(user.cookie).toContain('inventory_refresh=');
    const rawRefresh = decodeURIComponent(user.cookie.split('=')[1]);
    expect(jwt.decode(rawRefresh)).toMatchObject({ type: 'refresh', sub: user.id });
    const stored = await db.session.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored.refreshHash).toBe(createHash('sha256').update(rawRefresh).digest('hex'));
    const fresh = await post('/auth/refresh').set('Cookie', user.cookie).expect(200);
    expect(fresh.headers['set-cookie'][0]).toMatch(/HttpOnly/u);
    expect(fresh.headers['set-cookie'][0]).toMatch(/SameSite=Lax/u);
    await post('/auth/refresh').set('Cookie', user.cookie).expect(401);
    await get('/me', fresh.body.data.accessToken).expect(200);
    await post('/auth/logout').set('Cookie', cookie(fresh)).expect(204);
    await get('/me', fresh.body.data.accessToken).expect(401);
    await post('/auth/refresh').set('Cookie', cookie(fresh)).expect(401);
    await post('/auth/logout').expect(204);
  });
  it('allows only one refresh in a race and rejects expired or forged access', async () => {
    const user = await account('race');
    const results = await Promise.all([
      post('/auth/refresh').set('Cookie', user.cookie),
      post('/auth/refresh').set('Cookie', user.cookie),
    ]);
    expect(results.map((value) => value.status).sort()).toEqual([200, 401]);
    await request(app).get('/api/me').expect(401);
    await get('/me', 'not-a-token').expect(401);
    const claims = jwt.decode(user.access) as { sid: string; sub: string };
    const expired = jwt.sign({ sid: claims.sid, type: 'access' }, config.ACCESS_SECRET, {
      subject: claims.sub,
      expiresIn: -1,
      issuer: 'college-inventory',
      audience: 'inventory-client',
    });
    await get('/me', expired).expect(401);
    await post('/auth/refresh').expect(401);
  });
  it('enforces server roles and keeps the users list paginated, filtered and free of hashes', async () => {
    const teacher = await account('teacher');
    const technician = await account('technician', 'technician');
    const admin = await account('admin', 'admin');
    await get('/users', teacher.access).expect(403);
    await get('/users', technician.access).expect(403);
    const result = await get(
      `/users?search=${suffix}&role=admin&sort=email&order=desc&pageSize=1`,
      admin.access,
    ).expect(200);
    expect(result.body.total).toBe(1);
    expect(result.body.data[0].id).toBe(admin.id);
    expect(JSON.stringify(result.body)).not.toContain('passwordHash');
    await get('/users?sort=passwordHash', admin.access).expect(422);
    await get('/users?pageSize=999', admin.access).expect(422);
  });
  it('edits only the current profile and returns only its own audit activity', async () => {
    const first = await account('profile');
    const second = await account('other');
    const updated = await patch('/me', first.access)
      .send({ name: 'Updated', email: email('profile') })
      .expect(200);
    expect(updated.body.data.name).toBe('Updated');
    await patch('/me', first.access)
      .send({ name: 'Intruder', email: email('profile'), id: second.id })
      .expect(422);
    await patch('/me', first.access)
      .send({ name: 'Duplicate', email: email('other') })
      .expect(409);
    const activity = await get('/me/activity?pageSize=1', first.access).expect(200);
    expect(activity.body.data).toHaveLength(1);
    expect(activity.body.data[0].actorId).toBe(first.id);
    expect(activity.body.total).toBeGreaterThan(1);
    expect((await db.user.findUniqueOrThrow({ where: { id: second.id } })).name).toBe('other');
  });
  it('changes the password only with the current password and revokes every session', async () => {
    const user = await account('password');
    const second = await post('/auth/login')
      .send({ email: email('password'), password })
      .expect(200);
    await patch('/me/password', user.access)
      .send({ currentPassword: 'wrong', password: 'New-password-2026' })
      .expect(400);
    await patch('/me/password', user.access)
      .send({ currentPassword: password, password })
      .expect(400);
    await patch('/me/password', user.access)
      .send({ currentPassword: password, password: 'New-password-2026' })
      .expect(204);
    await get('/me', user.access).expect(401);
    await get('/me', second.body.data.accessToken).expect(401);
    await post('/auth/login')
      .send({ email: email('password'), password })
      .expect(401);
    await post('/auth/login')
      .send({ email: email('password'), password: 'New-password-2026' })
      .expect(200);
  });
  it('logs reset links without exposing them in responses and permits one use only', async () => {
    const user = await account('reset');
    const missing = await post('/auth/forgot-password')
      .send({ email: email('absent') })
      .expect(202);
    const existing = await post('/auth/forgot-password')
      .send({ email: email('reset') })
      .expect(202);
    expect(existing.body).toEqual(missing.body);
    const token = new URL(resetLinks.at(-1)!).searchParams.get('token')!;
    expect(JSON.stringify(existing.body)).not.toContain(token);
    await post('/auth/reset-password')
      .send({ token: 'a'.repeat(64), password })
      .expect(400);
    await post('/auth/reset-password')
      .send({ token, password: 'Reset-password-2026' })
      .expect(204);
    await post('/auth/reset-password').send({ token, password }).expect(400);
    await get('/me', user.access).expect(401);
    await post('/auth/login')
      .send({ email: email('reset'), password: 'Reset-password-2026' })
      .expect(200);
  });
  it('rejects expired reset links and does not send links for blocked users', async () => {
    const user = await account('expired');
    await post('/auth/forgot-password')
      .send({ email: email('expired') })
      .expect(202);
    const token = new URL(resetLinks.at(-1)!).searchParams.get('token');
    await db.passwordReset.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(0) },
    });
    await post('/auth/reset-password').send({ token, password }).expect(400);
    await db.user.update({ where: { id: user.id }, data: { isBlocked: true } });
    const count = resetLinks.length;
    await post('/auth/forgot-password')
      .send({ email: email('expired') })
      .expect(202);
    expect(resetLinks).toHaveLength(count);
  });
  it('rejects cross-origin mutations, malformed JSON and oversized bodies, and serves OpenAPI', async () => {
    await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://untrusted.example')
      .send({})
      .expect(403);
    await request(app).post('/api/auth/logout').expect(403);
    await post('/auth/login').set('Content-Type', 'application/json').send('{').expect(400);
    await post('/auth/login')
      .send({ email: 'a'.repeat(40000) })
      .expect(413);
    await request(app).get('/api/health').expect(200);
    const spec = await request(app).get('/api/openapi.json').expect(200);
    expect(spec.body.openapi).toBe('3.0.3');
    expect(spec.body.paths['/me/password']).toBeDefined();
    await request(app).get('/api/docs/').expect(200);
  });
});
