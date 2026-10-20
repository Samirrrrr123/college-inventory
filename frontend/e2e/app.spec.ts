import { expect, test } from '@playwright/test';

test('catalog supports demo creation, validation and confirmed deletion', async ({ page }) => {
  await page.goto('/equipment');
  await page.getByRole('button', { name: '+ Добавить' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Название *', { exact: true }).fill('Тестовый монитор');
  await dialog.getByLabel('Инвентарный номер *').fill('DEMO-100');
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.getByLabel('Поиск', { exact: true }).fill('DEMO-100');
  await page.getByRole('button', { name: 'Открыть: Тестовый монитор' }).click();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Открыть: Тестовый монитор' })).toBeFocused();
  await page.getByRole('button', { name: 'Открыть: Тестовый монитор' }).click();
  await dialog.getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(dialog.getByRole('heading', { name: 'Удалить оборудование?' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ничего не найдено' })).toBeVisible();
});

test('theme and language persist and system theme follows the browser', async ({ page }) => {
  await page.goto('/profile');
  await page.getByRole('radio', { name: 'Тёмная' }).check();
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Profile', exact: true })).toBeVisible();
  await page.getByRole('radio', { name: 'System' }).check();
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('all main screens fit the required viewport range', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [360, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of ['/', '/equipment', '/requests', '/rooms', '/administration', '/profile']) {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        .toBe(true);
    }
  }
  expect(errors).toEqual([]);
});
