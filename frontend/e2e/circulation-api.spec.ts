import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function login(page: Page, role: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(`${role}@college.test`);
  await page.getByLabel('Пароль', { exact: true }).fill(process.env.SEED_PASSWORD!);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/equipment$/u);
  await page.locator('nav a[href="/app/requests"]').click();
  await expect(page).toHaveURL(/\/app\/requests$/u);
  await expect(page.getByRole('heading', { name: 'Заявки и выдачи', level: 1 })).toBeVisible();
  await expect(page.locator('.catalog-panel')).toHaveAttribute('aria-busy', 'false');
}

test.describe('Requests, loans and returns with PostgreSQL', () => {
  test.skip(
    process.env.RUN_API_TESTS !== '1' || !process.env.SEED_PASSWORD,
    'Requires the real API and seeded accounts',
  );

  test('teacher requests two items and staff approve, issue and return the entire set', async ({
    browser,
    page,
  }) => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const session = await page.request.post('/api/auth/login', {
      headers: { Origin: 'http://127.0.0.1:5173' },
      data: { email: 'admin@college.test', password: process.env.SEED_PASSWORD },
    });
    expect(session.status()).toBe(200);
    const headers = {
      Origin: 'http://127.0.0.1:5173',
      Authorization: `Bearer ${(await session.json()).data.accessToken}`,
    };
    const categories = await (await page.request.get('/api/categories', { headers })).json();
    const rooms = await (await page.request.get('/api/rooms', { headers })).json();
    const equipmentIds: string[] = [];
    for (const index of [1, 2]) {
      const created = await page.request.post('/api/equipment', {
        headers,
        data: {
          name: `Комплект ${suffix} ${index}`,
          inventoryNumber: `CIRC-${suffix}-${index}`,
          categoryId: categories.data[0].id,
          roomId: rooms.data[0].id,
        },
      });
      expect(created.status()).toBe(201);
      equipmentIds.push((await created.json()).data.id as string);
    }
    const teacherContext = await browser.newContext();
    const teacher = await teacherContext.newPage();
    await login(teacher, 'teacher');
    await teacher.getByRole('button', { name: 'Новая заявка', exact: true }).click();
    let dialog = teacher.getByRole('dialog');
    await dialog
      .getByLabel('Для чего нужно оборудование', { exact: true })
      .fill(`Занятие ${suffix}`);
    await dialog.getByLabel('Найти в списке оборудования', { exact: true }).fill(suffix);
    await expect(dialog.getByRole('checkbox')).toHaveCount(2);
    await dialog.getByRole('checkbox').nth(0).check();
    await dialog.getByRole('checkbox').nth(1).check();
    const requestResponse = teacher.waitForResponse(
      (response) =>
        response.url().endsWith('/api/requests') && response.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: 'Отправить заявку', exact: true }).click();
    expect((await requestResponse).status()).toBe(201);
    await expect(dialog).toHaveCount(0);
    await teacher.getByLabel('Поиск', { exact: true }).fill(suffix);
    await expect(teacher.locator('tbody tr')).toHaveCount(1);
    await expect(teacher.locator('tbody tr')).toContainText('Ожидает');
    await login(page, 'technician');
    await page.getByLabel('Поиск', { exact: true }).fill(suffix);
    const row = page.locator('tbody tr').filter({ hasText: `Комплект ${suffix} 1` });
    await row.getByRole('button', { name: 'Одобрить', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByLabel('Комментарий к решению', { exact: true }).fill('Можно выдать комплект');
    await dialog.getByRole('button', { name: 'Одобрить', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await row.getByRole('button', { name: 'Оформить выдачу', exact: true }).click();
    dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(`Комплект ${suffix} 1`);
    await expect(dialog).toContainText(`Комплект ${suffix} 2`);
    await dialog
      .getByLabel('Вернуть до', { exact: true })
      .fill(new Date(Date.now() + 86400000).toISOString().slice(0, 10));
    const issueResponse = page.waitForResponse(
      (response) => response.url().endsWith('/api/loans') && response.request().method() === 'POST',
    );
    await dialog.getByRole('button', { name: 'Оформить выдачу', exact: true }).click();
    const issued = await issueResponse;
    expect(issued.status()).toBe(201);
    const loanId = (await issued.json()).data.id as string;
    await expect(dialog).toHaveCount(0);
    await page.getByRole('tab', { name: 'Активные выдачи', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody tr')).toContainText(`Комплект ${suffix} 2`);
    await teacher.reload();
    await teacher.getByLabel('Поиск', { exact: true }).fill(suffix);
    await expect(teacher.locator('tbody tr')).toHaveCount(1);
    await expect(teacher.locator('tbody tr')).toContainText('Выдано');
    await teacher.getByRole('tab', { name: 'Активные выдачи', exact: true }).click();
    await expect(teacher.locator('tbody tr')).toHaveCount(1);
    await expect(teacher.getByRole('button', { name: 'Принять возврат' })).toHaveCount(0);
    await row.getByRole('button', { name: 'Принять возврат', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Принять возврат', exact: true })
      .click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('tab', { name: 'Возвраты', exact: true }).click();
    await expect(page.locator('tbody tr')).toContainText('Возвращено');
    for (const id of equipmentIds) {
      const equipment = await (await page.request.get(`/api/equipment/${id}`, { headers })).json();
      expect(equipment.data.status).toBe('available');
    }
    const repeated = await page.request.post(`/api/loans/${loanId}/return`, { headers, data: {} });
    expect(repeated.status()).toBe(409);
    await teacherContext.close();
  });

  test('live request tabs and forms fit desktop and a dark English mobile screen', async ({
    page,
  }) => {
    await login(page, 'admin');
    for (const width of [360, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const name of ['Заявки', 'Активные выдачи', 'Возвраты']) {
        await page.getByRole('tab', { name, exact: true }).click();
        await expect(page.locator('.catalog-panel')).toHaveAttribute('aria-busy', 'false');
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
          .toBe(true);
      }
    }
    await page.setViewportSize({ width: 360, height: 900 });
    await page.getByRole('button', { name: 'Открыть меню', exact: true }).click();
    await page.getByRole('button', { name: 'Язык интерфейса', exact: true }).click();
    await page.getByRole('button', { name: 'Appearance', exact: true }).click();
    await page.locator('nav a[href="/app/requests"]').click();
    for (const name of ['New request', 'Issue without a request']) {
      await page.getByRole('button', { name, exact: true }).click();
      const dialog = page.getByRole('dialog');
      const cancel = dialog.getByRole('button', { name: 'Cancel', exact: true });
      await cancel.scrollIntoViewIfNeeded();
      await expect(cancel).toBeInViewport();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
      await cancel.click();
    }
  });
});
