import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/equipment$/u);
}

test('admin changes roles, blocks and unblocks an account and protects the last admin', async ({
  browser,
  page,
  baseURL,
}) => {
  test.skip(
    process.env.RUN_API_TESTS !== '1' || !process.env.SEED_PASSWORD,
    'Requires API and seeded accounts',
  );
  test.setTimeout(90000);
  const suffix = crypto.randomUUID().slice(0, 8);
  const email = `access-${suffix}@college.test`;
  const password = `Access-${suffix}-test`;
  const name = `Проверка доступа ${suffix}`;
  const registered = await page.request.post('/api/auth/register', {
    headers: { Origin: new URL(baseURL!).origin },
    data: { name, email, password },
  });
  expect(registered.status()).toBe(201);
  const userContext = await browser.newContext();
  const user = await userContext.newPage();
  await signIn(user, email, password);
  await signIn(page, 'admin@college.test', process.env.SEED_PASSWORD!);
  await page.locator('nav a[href="/app/users"]').click();
  await expect(
    page.getByRole('heading', { name: 'Пользователи', level: 1, exact: true }),
  ).toBeVisible();
  await page.getByLabel('Поиск', { exact: true }).fill(suffix);
  const row = page.locator('tbody tr').filter({ hasText: email });
  await row.getByRole('button', { name: `Изменить доступ: ${name}`, exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Роль', { exact: true }).selectOption('technician');
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row).toContainText('Лаборант');
  await user.reload();
  await expect(user).toHaveURL(/\/login$/u);
  await signIn(user, email, password);
  await expect(user.locator('nav a[href="/app/inventory"]')).toBeVisible();
  await expect(user.locator('nav a[href="/app/users"]')).toHaveCount(0);
  await row.getByRole('button', { name: `Изменить доступ: ${name}`, exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox', { name: 'Заблокировать аккаунт', exact: true }).check();
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(row).toContainText('Заблокирован');
  await user.reload();
  await expect(user).toHaveURL(/\/login$/u);
  const denied = await user.request.post('/api/auth/login', {
    headers: { Origin: new URL(baseURL!).origin },
    data: { email, password },
  });
  expect(denied.status()).toBe(401);
  await row.getByRole('button', { name: `Изменить доступ: ${name}`, exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox', { name: 'Заблокировать аккаунт', exact: true }).uncheck();
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await signIn(user, email, password);
  await expect(user.locator('nav a[href="/app/inventory"]')).toBeVisible();
  await row.getByRole('button', { name: `Изменить доступ: ${name}`, exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox', { name: 'Заблокировать аккаунт', exact: true }).check();
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByLabel('Поиск', { exact: true }).fill('admin@college.test');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('admin@college.test');
  await page
    .locator('tbody tr')
    .getByRole('button', { name: /^Изменить доступ:/u })
    .click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Роль', { exact: true })).toBeDisabled();
  await expect(
    dialog.getByRole('checkbox', { name: 'Заблокировать аккаунт', exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByText('Нельзя отключить последнего активного администратора', { exact: true }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
  for (const width of [360, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  }
  await userContext.close();
});
