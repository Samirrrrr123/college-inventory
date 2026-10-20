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
    for (const path of [
      '/',
      '/equipment',
      '/requests',
      '/rooms',
      '/administration',
      '/profile',
      '/login',
      '/register',
      '/forgot-password',
      '/reset-password?token=example-reset-code',
    ]) {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        .toBe(true);
    }
  }
  expect(errors).toEqual([]);
});

test('public forms validate data and keep the demo separate from signing in', async ({ page }) => {
  await page.route('**/api/auth/register', (route) => route.abort('failed'));
  await page.goto('/login');
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByLabel('Email')).toBeFocused();
  await page.getByRole('link', { name: 'Нет аккаунта? Зарегистрироваться →' }).click();
  await page.getByLabel('Имя', { exact: true }).fill('Анна');
  await page.getByLabel('Email').fill('anna@college.test');
  await page.getByLabel('Пароль', { exact: true }).fill('Example-123');
  await page.getByLabel('Повторите пароль', { exact: true }).fill('Different-123');
  await page.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await expect(page.getByText('Пароли не совпадают')).toBeVisible();
  await page.getByLabel('Повторите пароль', { exact: true }).fill('Example-123');
  await page.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
  await expect(page.getByText('Сервер недоступен. Попробуйте ещё раз позже.')).toBeVisible();
  await expect(page.getByLabel('Пароль', { exact: true })).toHaveValue('');
  await expect(page).toHaveURL(/\/register$/);
  await page.getByRole('button', { name: 'Язык интерфейса' }).click();
  await page.getByRole('button', { name: 'Appearance', exact: true }).click();
  await page.setViewportSize({ width: 360, height: 900 });
  await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.getByRole('link', { name: 'Explore the demo →' }).click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
});
