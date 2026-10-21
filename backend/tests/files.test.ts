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
let equipmentId: string;
let otherId: string;
let categoryId: string;
let roomId: string;
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7V0AAAAASUVORK5CYII=',
  'base64',
);
const api = (method: 'get' | 'post' | 'delete', path: string, role = 1) => {
  const client = request(app);
  return client[method](`/api/equipment/${path}`)
    .set('Origin', config.CLIENT_ORIGIN)
    .auth(users[role].token, { type: 'bearer' });
};
const upload = (
  name = 'фото.png',
  bytes = png,
  type = 'image/png',
  role = 1,
  equipment = equipmentId,
) =>
  api('post', `${equipment}/files`, role)
    .set('Content-Type', type)
    .set('X-File-Name', encodeURIComponent(name))
    .send(bytes);

beforeAll(async () => {
  const password = 'Files-test-password';
  const passwordHash = await bcrypt.hash(password, 4);
  for (const code of ['teacher', 'technician', 'admin']) {
    const role = await db.role.upsert({ where: { code }, create: { code }, update: {} });
    const email = `files-${code}-${suffix}@college.test`;
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
  categoryId = (await db.category.create({ data: { name: `Files ${suffix}` } })).id;
  roomId = (
    await db.room.create({
      data: { number: suffix.slice(0, 20), name: 'Files', building: suffix, floor: 0 },
    })
  ).id;
  for (const index of [0, 1]) {
    const item = await db.equipment.create({
      data: { name: `Files ${index}`, inventoryNumber: randomUUID(), categoryId, roomId },
    });
    if (index === 0) equipmentId = item.id;
    else otherId = item.id;
  }
});
afterAll(async () => {
  const ids = users.map((user) => user.id);
  await db.attachment.deleteMany({ where: { uploadedById: { in: ids } } });
  await db.auditEntry.deleteMany({ where: { actorId: { in: ids } } });
  if (categoryId) await db.equipment.deleteMany({ where: { categoryId } });
  if (categoryId) await db.category.delete({ where: { id: categoryId } });
  if (roomId) await db.room.delete({ where: { id: roomId } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.$disconnect();
});

describe('Equipment files with PostgreSQL', () => {
  it('stores exact bytes and real uploader, lists metadata and downloads with safe headers', async () => {
    const uploaded = await upload().expect(201);
    const file = uploaded.body.data;
    expect(file.uploadedById).toBe(users[1].id);
    expect(file.size).toBe(png.length);
    expect(file).not.toHaveProperty('content');
    const saved = await db.attachment.findUniqueOrThrow({ where: { id: file.id as string } });
    expect(Buffer.from(saved.content)).toEqual(png);
    const list = await api(
      'get',
      `${equipmentId}/files?search=${encodeURIComponent('фото')}`,
      0,
    ).expect(200);
    expect(list.body.data.some((entry: { id: string }) => entry.id === file.id)).toBe(true);
    expect(JSON.stringify(list.body)).not.toContain('password');
    const downloaded = await api('get', `${equipmentId}/files/${file.id}`, 0).expect(200);
    expect(downloaded.body).toEqual(png);
    expect(downloaded.headers['content-disposition']).toContain("filename*=UTF-8''");
    expect(downloaded.headers['x-content-type-options']).toBe('nosniff');
    expect(downloaded.headers['cache-control']).toBe('no-store');
    expect(
      await db.auditEntry.count({
        where: { entityId: equipmentId, action: 'fileUploaded', actorId: users[1].id },
      }),
    ).toBeGreaterThan(0);
  });

  it('requires login and staff rights and rejects blocked users', async () => {
    const file = (await upload('rights.png').expect(201)).body.data;
    await request(app).get(`/api/equipment/${equipmentId}/files/${file.id}`).expect(401);
    await request(app)
      .post(`/api/equipment/${equipmentId}/files`)
      .set('Origin', config.CLIENT_ORIGIN)
      .set('Content-Type', 'image/png')
      .send(png)
      .expect(401);
    await upload('teacher.png', png, 'image/png', 0).expect(403);
    await api('delete', `${equipmentId}/files/${file.id}`, 0).expect(403);
    await db.user.update({ where: { id: users[0].id }, data: { isBlocked: true } });
    await api('get', `${equipmentId}/files/${file.id}`, 0).expect(401);
    await db.user.update({ where: { id: users[0].id }, data: { isBlocked: false } });
  });

  it('rejects fake formats, mismatched extensions, empty bytes and unsafe file names', async () => {
    const before = await db.attachment.count({ where: { equipmentId } });
    await upload('bad.png', Buffer.from('<script>alert(1)</script>')).expect(415);
    await upload('bad.pdf').expect(415);
    await upload('bad.svg', png, 'image/svg+xml').expect(415);
    await upload('empty.png', Buffer.alloc(0)).expect(422);
    for (const name of [
      '../photo.png',
      'folder\\photo.png',
      'line\nphoto.png',
      `${'x'.repeat(157)}.png`,
    ])
      await upload(name).expect(422);
    await api('post', `${equipmentId}/files`)
      .set('Content-Type', 'image/png')
      .set('X-File-Name', '%broken')
      .send(png)
      .expect(422);
    expect(await db.attachment.count({ where: { equipmentId } })).toBe(before);
  });

  it('accepts the 5 MB boundary and rejects a larger file without saving it', async () => {
    const bytes = Buffer.alloc(5 * 1024 * 1024);
    png.copy(bytes);
    const file = (await upload('boundary.png', bytes).expect(201)).body.data;
    expect(file.size).toBe(bytes.length);
    await upload('too-large.png', Buffer.concat([bytes, Buffer.from([0])])).expect(413);
    await api('delete', `${equipmentId}/files/${file.id}`).expect(204);
  });

  it('checks file ownership by equipment and preserves delete audit and equipment references', async () => {
    const file = (await upload('delete.png', png, 'image/png', 2).expect(201)).body.data;
    await api('get', `${otherId}/files/${file.id}`).expect(404);
    await api('delete', `${otherId}/files/${file.id}`).expect(404);
    await api('delete', equipmentId).expect(409);
    await api('delete', `${equipmentId}/files/${file.id}`, 2).expect(204);
    await api('get', `${equipmentId}/files/${file.id}`).expect(404);
    await api('delete', `${equipmentId}/files/${file.id}`).expect(404);
    expect(
      await db.auditEntry.count({
        where: { actorId: users[2].id, action: 'fileDeleted', entityId: equipmentId },
      }),
    ).toBe(1);
    await upload('missing.png', png, 'image/png', 1, randomUUID()).expect(404);
    await api('get', `${randomUUID()}/files`).expect(404);
  });

  it('supports server paging, search, sorting, PDF and JPG', async () => {
    await upload(
      'sort-a.pdf',
      Buffer.from('%PDF-1.4\n%%EOF'),
      'application/pdf',
      2,
      otherId,
    ).expect(201);
    await upload(
      'sort-b.jpg',
      Buffer.from([255, 216, 255, 217]),
      'image/jpeg',
      2,
      otherId,
    ).expect(201);
    const page = await api(
      'get',
      `${otherId}/files?search=sort-&sort=name&order=asc&pageSize=1&page=2`,
      0,
    ).expect(200);
    expect(page.body.total).toBe(2);
    expect(page.body.data).toHaveLength(1);
    expect(page.body.data[0].name).toBe('sort-b.jpg');
    await api('get', `${otherId}/files?pageSize=101`).expect(422);
    await api('get', `${otherId}/files?sort=content`).expect(422);
  });
});
