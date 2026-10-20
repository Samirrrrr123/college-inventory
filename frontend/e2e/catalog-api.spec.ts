import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function login(page: Page, role = 'technician') {
  await page.goto('/login');
  await page.getByLabel('Email').fill(`${role}@college.test`);
  await page.getByLabel('Пароль', { exact: true }).fill(process.env.SEED_PASSWORD!);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/equipment$/u);
  await expect(page.locator('.catalog-panel')).toHaveAttribute('aria-busy', 'false');
}

async function openCatalog(page: Page, kind: 'equipment' | 'rooms' | 'categories') {
  await page.locator(`nav a[href="/app/${kind}"]`).click();
  await expect(page).toHaveURL(new RegExp(`/app/${kind}$`, 'u'));
  await expect(page.locator('.catalog-panel')).toHaveAttribute('aria-busy', 'false');
}

test.describe('Catalog connected to PostgreSQL', () => {
  test.skip(
    process.env.RUN_API_TESTS !== '1' || !process.env.SEED_PASSWORD,
    'Requires API, PostgreSQL and seeded test accounts',
  );

  test('staff manage directories and equipment, persist edits and cannot delete a linked category', async ({
    page,
  }) => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const category = `Тестовая категория ${suffix}`;
    const room = `Тестовая аудитория ${suffix}`;
    const equipment = `Тестовый монитор ${suffix}`;
    const inventoryNumber = `LIVE-${suffix.toUpperCase()}`;
    await login(page);
    await openCatalog(page, 'categories');
    await page.getByRole('button', { name: '+ Добавить категорию', exact: true }).click();
    let dialog = page.getByRole('dialog');
    await dialog.getByLabel('Название', { exact: true }).fill(category);
    await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await openCatalog(page, 'rooms');
    await page.getByRole('button', { name: '+ Добавить аудиторию', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByLabel('Номер аудитории', { exact: true }).fill(`QA-${suffix}`);
    await dialog.getByLabel('Название', { exact: true }).fill(room);
    await dialog.getByLabel('Корпус', { exact: true }).fill('Учебный корпус');
    await dialog.getByLabel('Этаж', { exact: true }).fill('0');
    await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByLabel('Поиск', { exact: true }).fill(suffix);
    await expect(page.getByRole('cell', { name: room, exact: true })).toBeVisible();
    await page.reload();
    await page.getByLabel('Поиск', { exact: true }).fill(suffix);
    await page.getByLabel('Этаж', { exact: true }).fill('0');
    await expect(page.getByRole('cell', { name: room, exact: true })).toBeVisible();
    await openCatalog(page, 'equipment');
    await page.getByRole('button', { name: '+ Добавить', exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByLabel('Название *', { exact: true }).fill(equipment);
    await dialog.getByLabel('Инвентарный номер *', { exact: true }).fill(inventoryNumber);
    await dialog.getByLabel('Категория', { exact: true }).selectOption({ label: category });
    await dialog
      .getByLabel('Аудитория', { exact: true })
      .selectOption({ label: `QA-${suffix} · ${room} · Учебный корпус` });
    await dialog.getByLabel('Описание', { exact: true }).fill('Описание сохраняется в PostgreSQL');
    await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByLabel('Поиск', { exact: true }).fill(inventoryNumber);
    await page.getByRole('button', { name: `Открыть: ${equipment}`, exact: true }).click();
    dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Описание сохраняется в PostgreSQL')).toBeVisible();
    await dialog.getByRole('button', { name: 'Изменить', exact: true }).click();
    await dialog.getByLabel('Статус', { exact: true }).selectOption('repair');
    await dialog.getByLabel('Серийный номер', { exact: true }).fill('SERIAL-LIVE');
    await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await page.reload();
    await page.getByLabel('Поиск', { exact: true }).fill(inventoryNumber);
    await expect(page.getByRole('row').filter({ hasText: inventoryNumber })).toContainText(
      'В ремонте',
    );
    await openCatalog(page, 'categories');
    await page.getByLabel('Поиск', { exact: true }).fill(category);
    await page.getByRole('button', { name: `Удалить: ${category}`, exact: true }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Удалить', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('связана');
    await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
    await openCatalog(page, 'equipment');
    await page.getByLabel('Поиск', { exact: true }).fill(inventoryNumber);
    await page.getByRole('button', { name: `Открыть: ${equipment}`, exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Ничего не найдено', exact: true }),
    ).toBeVisible();
    await openCatalog(page, 'categories');
    await page.getByLabel('Поиск', { exact: true }).fill(category);
    await page.getByRole('button', { name: `Удалить: ${category}`, exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await openCatalog(page, 'rooms');
    await page.getByLabel('Поиск', { exact: true }).fill(room);
    await page.getByRole('button', { name: `Удалить: ${room}`, exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Удалить', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('teacher lists use server paging, filters and sorting and prohibit mutations', async ({
    page,
  }) => {
    await login(page, 'teacher');
    await expect(page.getByRole('button', { name: '+ Добавить', exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Посмотреть как', { exact: true })).toHaveCount(0);
    const next = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === '/api/equipment' && url.searchParams.get('page') === '2';
    });
    await page.getByRole('button', { name: 'Следующая страница', exact: true }).click();
    expect((await next).status()).toBe(200);
    const order = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === '/api/equipment' && url.searchParams.get('order') === 'desc';
    });
    await page.getByRole('button', { name: 'Сортировать по названию', exact: true }).click();
    expect((await order).status()).toBe(200);
    await page.getByLabel('Статус', { exact: true }).selectOption('repair');
    await expect(page.locator('.catalog-panel')).toHaveAttribute('aria-busy', 'false');
    for (const row of await page.locator('tbody tr').all())
      await expect(row).toContainText('В ремонте');
    const session = await page.request.post('/api/auth/login', {
      headers: { Origin: 'http://127.0.0.1:5173' },
      data: { email: 'teacher@college.test', password: process.env.SEED_PASSWORD },
    });
    expect(session.status()).toBe(200);
    const access = (await session.json()).data.accessToken;
    const denied = await page.request.post('/api/categories', {
      headers: { Origin: 'http://127.0.0.1:5173', Authorization: `Bearer ${access}` },
      data: { name: 'Forbidden category' },
    });
    expect(denied.status()).toBe(403);
    await page.getByRole('link', { name: 'Категории', exact: true }).click();
    await expect(
      page.getByRole('button', { name: '+ Добавить категорию', exact: true }),
    ).toHaveCount(0);
  });

  test('live screens and forms fit mobile, English and dark mode', async ({ page }) => {
    await login(page, 'admin');
    for (const width of [360, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const path of ['/app/equipment', '/app/rooms', '/app/categories']) {
        await page.goto(path);
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
    await page.getByRole('link', { name: 'Equipment', exact: true }).click();
    await expect(page.locator('.catalog-panel')).toHaveAttribute('aria-busy', 'false');
    await page.getByRole('button', { name: '+ Add', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeInViewport();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  });
});
