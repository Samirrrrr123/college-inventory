import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
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
const rooms: string[] = [];
let categoryId: string;
const get = (query = '', role = 2) =>
  request(app)
    .get(`/api/equipment/export?${query}`)
    .auth(users[role].token, { type: 'bearer' });
async function workbook(query: string, role = 2) {
  const response = await get(query, role)
    .buffer(true)
    .parse((res, callback) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => callback(null, Buffer.concat(chunks)));
      res.on('error', callback);
    })
    .expect(200);
  expect(response.headers['content-type']).toMatch(
    /^application\/vnd.openxmlformats-officedocument.spreadsheetml.sheet/,
  );
  expect(response.headers['content-disposition']).toBe('attachment; filename=equipment.xlsx');
  expect(response.headers['cache-control']).toBe('no-store');
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Uint8Array.from(response.body as Buffer).buffer);
  return book.worksheets[0];
}
beforeAll(async () => {
  const password = 'Report-test-password';
  const passwordHash = await bcrypt.hash(password, 4);
  for (const [index, code] of ['teacher', 'technician', 'admin'].entries()) {
    const role = await db.role.upsert({ where: { code }, create: { code }, update: {} });
    const email = `report-${index}-${suffix}@college.test`;
    const user = await db.user.create({
      data: { name: `Report ${index}`, email, passwordHash, roleId: role.id },
    });
    const login = await request(app)
      .post('/api/auth/login')
      .set('Origin', config.CLIENT_ORIGIN)
      .send({ email, password })
      .expect(200);
    users.push({ id: user.id, token: login.body.data.accessToken as string });
  }
  categoryId = (await db.category.create({ data: { name: suffix } })).id;
  for (let index = 0; index < 2; index++)
    rooms.push(
      (
        await db.room.create({
          data: { number: String(index), name: 'Report room', building: suffix, floor: 0 },
        })
      ).id,
    );
  await db.equipment.createMany({
    data: Array.from({ length: 12 }, (_, index) => ({
      name: `Тест экспорта ${String(index).padStart(2, '0')}`,
      inventoryNumber: `REPORT-${suffix}-${index}`,
      categoryId,
      roomId: rooms[index % 2],
      status: index < 8 ? ('repair' as const) : ('available' as const),
    })),
  });
});
afterAll(async () => {
  const ids = users.map((user) => user.id);
  if (categoryId) await db.equipment.deleteMany({ where: { categoryId } });
  await db.auditEntry.deleteMany({ where: { actorId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.room.deleteMany({ where: { id: { in: rooms } } });
  if (categoryId) await db.category.delete({ where: { id: categoryId } });
  await db.$disconnect();
});
describe('XLSX API with PostgreSQL', () => {
  it('requires a session and denies teachers even through a direct URL', async () => {
    await request(app).get('/api/equipment/export').expect(401);
    await get('', 0).expect(403);
    await workbook(`categoryId=${categoryId}`, 1);
  });
  it('exports all matching rows beyond one catalog page, in the same order', async () => {
    const sheet = await workbook(`categoryId=${categoryId}&sort=name&order=desc`);
    expect(sheet.rowCount).toBe(13);
    expect(sheet.getCell('B2').value).toBe('Тест экспорта 11');
    expect(sheet.getCell('B13').value).toBe('Тест экспорта 00');
  });
  it('combines category, room, status and search filters exactly like the catalog', async () => {
    const query = `categoryId=${categoryId}&roomId=${rooms[0]}&status=repair&search=${encodeURIComponent('Тест экспорта')}&order=desc`;
    const sheet = await workbook(query);
    const listed = await request(app)
      .get(`/api/equipment?${query}&pageSize=100`)
      .auth(users[2].token, { type: 'bearer' })
      .expect(200);
    expect(sheet.rowCount).toBe(5);
    const numbers = Array.from(
      { length: 4 },
      (_, index) => sheet.getCell(`A${index + 2}`).value,
    );
    expect(numbers).toEqual(
      listed.body.data.map((item: { inventoryNumber: string }) => item.inventoryNumber),
    );
  });
  it('returns an empty workbook, validates input and rejects blocked users', async () => {
    const sheet = await workbook(`categoryId=${categoryId}&search=does-not-exist&language=en`);
    expect(sheet.rowCount).toBe(1);
    expect(sheet.getCell('B1').value).toBe('Equipment');
    for (const query of ['language=invalid', 'page=2', 'roomId=invalid', 'sort=invalid'])
      await get(query).expect(422);
    await db.user.update({ where: { id: users[1].id }, data: { isBlocked: true } });
    await get('', 1).expect(401);
  });
});
