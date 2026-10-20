import { expect, test } from '@playwright/test';

test.describe('Accounts with the real API', () => {
  test.skip(process.env.RUN_API_TESTS !== '1', 'Requires a running API and migrated PostgreSQL');

  test('registers, signs in, restores a session after reload, saves a profile and signs out', async ({
    page,
  }) => {
    const email = `browser-${crypto.randomUUID()}@college.test`;
    const password = 'Browser-Password-2026';
    await page.goto('/register');
    await page.getByLabel('Имя', { exact: true }).fill('Тестовый преподаватель');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Пароль', { exact: true }).fill(password);
    await page.getByLabel('Повторите пароль', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Создать аккаунт', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Аккаунт создан');
    await page.getByRole('link', { name: 'Уже есть аккаунт? Войти →' }).click();
    await expect(page.getByRole('heading', { name: 'Вход в систему', exact: true })).toBeVisible();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Пароль', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(page).toHaveURL(/\/app\/equipment$/u);
    await page.getByRole('link', { name: 'Личный кабинет', exact: true }).click();
    await expect(page.getByLabel('Имя', { exact: true })).toHaveValue('Тестовый преподаватель');
    await expect(page.getByText('Преподаватель', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Email')).toHaveValue(email);
    await page.getByLabel('Имя', { exact: true }).fill('Новое имя преподавателя');
    await page.getByRole('button', { name: 'Сохранить изменения', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Профиль');
    await page.reload();
    await expect(page.getByLabel('Имя', { exact: true })).toHaveValue('Новое имя преподавателя');
    const storage = await page.evaluate(() =>
      JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
    );
    expect(storage).not.toContain(password);
    expect(storage).not.toContain('accessToken');
    expect(storage).not.toContain(email);
    const cookies = await page.context().cookies();
    expect(cookies.find((cookie) => cookie.name === 'inventory_refresh')).toMatchObject({
      httpOnly: true,
      sameSite: 'Lax',
      path: '/api/auth',
    });
    for (const width of [360, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
        .toBe(true);
    }
    await page.getByRole('button', { name: 'Выйти из аккаунта', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/u);
    await page.goto('/account');
    await expect(page).toHaveURL(/\/login$/u);
  });

  test('changes a password through the profile and invalidates the old password', async ({
    page,
  }) => {
    const email = `password-${crypto.randomUUID()}@college.test`;
    const oldPassword = 'Initial-Password-2026';
    const newPassword = 'Changed-Password-2026';
    const registration = await page.request.post('/api/auth/register', {
      headers: { Origin: 'http://127.0.0.1:5173' },
      data: { name: 'Проверка пароля', email, password: oldPassword },
    });
    expect(registration.status()).toBe(201);
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Пароль', { exact: true }).fill(oldPassword);
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.getByRole('link', { name: 'Личный кабинет', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Мой аккаунт', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Изменить пароль', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Текущий пароль', { exact: true }).fill(oldPassword);
    await dialog.getByLabel('Новый пароль', { exact: true }).fill(newPassword);
    await dialog.getByLabel('Повторите пароль', { exact: true }).fill(newPassword);
    await dialog.getByRole('button', { name: 'Сохранить пароль', exact: true }).click();
    await expect(page).toHaveURL(/\/login\?passwordChanged=1$/u);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Пароль', { exact: true }).fill(oldPassword);
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(page.getByText('Неверный email или пароль.', { exact: true })).toBeVisible();
    await page.getByLabel('Пароль', { exact: true }).fill(newPassword);
    await page.getByRole('button', { name: 'Войти', exact: true }).click();
    await page.getByRole('link', { name: 'Личный кабинет', exact: true }).click();
    await expect(page.getByLabel('Email')).toHaveValue(email);
  });
});
