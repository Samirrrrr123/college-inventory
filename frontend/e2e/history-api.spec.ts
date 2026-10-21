import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function login(page: Page, role: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(`${role}@college.test`);
  await page.getByLabel('Пароль', { exact: true }).fill(process.env.SEED_PASSWORD!);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/equipment$/u);
}

async function historyFixture(page: Page, baseURL: string, count: number) {
  const origin = new URL(baseURL).origin;
  const suffix = crypto.randomUUID().slice(0, 8);
  const login = await page.request.post('/api/auth/login', {
    headers: { Origin: origin },
    data: { email: 'admin@college.test', password: process.env.SEED_PASSWORD },
  });
  expect(login.status()).toBe(200);
  const adminToken = (await login.json()).data.accessToken as string;
  const email = `history-e2e-${suffix}@college.test`;
  const password = `History-${suffix}-test`;
  const registered = await page.request.post('/api/auth/register', {
    headers: { Origin: origin },
    data: { name: `Автор истории ${suffix}`, email, password },
  });
  expect(registered.status()).toBe(201);
  const authorId = (await registered.json()).data.id as string;
  const promoted = await page.request.patch(`/api/users/${authorId}`, {
    headers: { Origin: origin, Authorization: `Bearer ${adminToken}` },
    data: { role: 'technician' },
  });
  expect(promoted.status()).toBe(200);
  const authorLogin = await page.request.post('/api/auth/login', {
    headers: { Origin: origin },
    data: { email, password },
  });
  expect(authorLogin.status()).toBe(200);
  const token = (await authorLogin.json()).data.accessToken as string;
  const headers = { Origin: origin, Authorization: `Bearer ${token}` };
  const category = await page.request.post('/api/categories', {
    headers,
    data: { name: `История ${suffix}` },
  });
  expect(category.status()).toBe(201);
  const rooms: string[] = [];
  for (let index = 0; index < 2; index++) {
    const response = await page.request.post('/api/rooms', {
      headers,
      data: {
        number: `H-${suffix}-${index}`,
        name: `История ${index}`,
        building: suffix,
        floor: 0,
      },
    });
    expect(response.status()).toBe(201);
    rooms.push((await response.json()).data.id as string);
  }
  const inventoryNumber = `HISTORY-${suffix.toUpperCase()}`;
  const equipment = await page.request.post('/api/equipment', {
    headers,
    data: {
      name: `Монитор ${suffix}`,
      inventoryNumber,
      categoryId: (await category.json()).data.id,
      roomId: rooms[0],
    },
  });
  expect(equipment.status()).toBe(201);
  const id = (await equipment.json()).data.id as string;
  for (let index = 0; index < count; index++) {
    const changed = await page.request.patch(`/api/equipment/${id}`, {
      headers,
      data: { roomId: rooms[(index + 1) % 2] },
    });
    expect(changed.status()).toBe(200);
  }
  const profile = await page.request.get('/api/me', { headers });
  return { inventoryNumber, rooms, actor: (await profile.json()).data.name as string };
}

test('staff browses real movement pages, filters rooms and uses RU/EN and mobile themes', async ({
  page,
  baseURL,
}) => {
  test.skip(
    process.env.RUN_API_TESTS !== '1' || !process.env.SEED_PASSWORD,
    'Requires API and seeded accounts',
  );
  test.setTimeout(90000);
  const fixture = await historyFixture(page, baseURL!, 11);
  await login(page, 'technician');
  await page.locator('nav a[href="/app/movements"]').click();
  await expect(
    page.getByRole('heading', { name: 'Перемещения', level: 1, exact: true }),
  ).toBeVisible();
  await page.getByLabel('Поиск', { exact: true }).fill(fixture.inventoryNumber);
  await expect(page.locator('tbody tr')).toHaveCount(10);
  await page.getByRole('button', { name: 'Следующая страница' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByLabel('Откуда', { exact: true }).selectOption(fixture.rooms[0]);
  await expect(page.locator('tbody tr')).toHaveCount(6);
  await expect(page.getByRole('button', { name: 'Следующая страница' })).toBeDisabled();
  await page.getByLabel('Имя автора', { exact: true }).fill(fixture.actor);
  await expect(page.locator('tbody tr')).toHaveCount(6);
  await page.getByLabel('Поиск', { exact: true }).fill(`missing-${fixture.inventoryNumber}`);
  await expect(page.getByRole('heading', { name: 'Ничего не найдено' })).toBeVisible();
  await page.getByRole('button', { name: 'Сбросить фильтры', exact: true }).first().click();
  await expect(page.locator('tbody tr').first()).toBeVisible();
  await page.locator('.sidebar-preferences button').first().click();
  await expect(page.getByRole('heading', { name: 'Movements', exact: true })).toBeVisible();
  await page.locator('.sidebar-preferences button').first().click();
  await page.locator('.sidebar-preferences button').nth(1).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  for (const width of [360, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  }
  await page.setViewportSize({ width: 360, height: 1000 });
  await page.screenshot({
    path: 'test-results/history-movements-360.png',
    fullPage: false,
    animations: 'disabled',
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Перемещения', exact: true })).toBeVisible();
  await expect(page.locator('tbody tr').first()).toBeVisible();
});

test('admin reads global audit while teacher cannot open either protected history page', async ({
  page,
  browser,
  baseURL,
}) => {
  test.skip(
    process.env.RUN_API_TESTS !== '1' || !process.env.SEED_PASSWORD,
    'Requires API and seeded accounts',
  );
  test.setTimeout(90000);
  const fixture = await historyFixture(page, baseURL!, 1);
  await login(page, 'admin');
  await page.locator('nav a[href="/app/audit"]').click();
  await expect(
    page.getByRole('heading', { name: 'Журнал аудита', level: 1, exact: true }),
  ).toBeVisible();
  await page.getByLabel('Действие', { exact: true }).selectOption('equipmentUpdated');
  await page.getByLabel('Тип объекта', { exact: true }).selectOption('equipment');
  await page.getByLabel('Поиск', { exact: true }).fill(fixture.actor);
  const row = page.locator('tbody tr').filter({ hasText: fixture.inventoryNumber });
  await expect(row).toHaveCount(1);
  await row.locator('summary').click();
  await expect(row.locator('pre')).toContainText('roomId');
  await page.setViewportSize({ width: 360, height: 1000 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({
    path: 'test-results/history-audit-360.png',
    fullPage: false,
    animations: 'disabled',
  });
  const context = await browser.newContext();
  const teacher = await context.newPage();
  await login(teacher, 'teacher');
  await expect(teacher.locator('nav a[href="/app/audit"]')).toHaveCount(0);
  await expect(teacher.locator('nav a[href="/app/movements"]')).toHaveCount(0);
  for (const path of ['audit', 'movements']) {
    await teacher.goto(`/app/${path}`);
    await expect(
      teacher.getByRole('heading', { name: 'Раздел недоступен для этой роли' }),
    ).toBeVisible();
  }
  await context.close();
});
