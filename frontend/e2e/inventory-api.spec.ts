import { expect, test } from '@playwright/test';

test('staff check a room, retain answers after reload and complete an immutable report', async ({
  browser,
  page,
}) => {
  test.skip(
    process.env.RUN_API_TESTS !== '1' || !process.env.SEED_PASSWORD,
    'Requires API and seeded accounts',
  );
  test.setTimeout(90000);
  await page.goto('/login');
  await page.getByLabel('Email').fill('technician@college.test');
  await page.getByLabel('Пароль', { exact: true }).fill(process.env.SEED_PASSWORD!);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/equipment$/u);
  await page.locator('nav a[href="/app/inventory"]').click();
  await page.getByRole('button', { name: 'Начать проверку', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const room = dialog.getByLabel('Аудитория', { exact: true });
  await expect(room.locator('option')).not.toHaveCount(1);
  await room.selectOption({ index: 1 });
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/inventory-checks') && response.request().method() === 'POST',
  );
  await dialog.getByRole('button', { name: 'Начать проверку', exact: true }).click();
  const response = await created;
  expect(response.status()).toBe(201);
  const check = (await response.json()).data as {
    id: string;
    number: number;
    _count: { items: number };
  };
  await expect(page).toHaveURL(new RegExp(`/app/inventory/${check.id}$`, 'u'));
  const summary = page.locator('[aria-label="Итоги проверки"]');
  await expect(summary).toContainText(`Не проверено: ${check._count.items}`);
  await expect(
    page.getByRole('button', { name: 'Завершить проверку', exact: true }),
  ).toBeDisabled();
  const firstName = await page.locator('tbody tr').first().locator('strong').textContent();
  await page.getByRole('button', { name: 'Нет на месте', exact: true }).first().click();
  await expect(summary).toContainText(`Не проверено: ${check._count.items - 1}`);
  await page.reload();
  await expect(summary).toContainText('Отсутствует: 1');
  await page.getByLabel('Результат', { exact: true }).selectOption('pending');
  for (let remaining = check._count.items - 1; remaining > 0; remaining--) {
    await page.getByRole('button', { name: 'На месте', exact: true }).first().click();
    await expect(summary).toContainText(`Не проверено: ${remaining - 1}`);
  }
  await page.setViewportSize({ width: 360, height: 900 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.getByRole('button', { name: 'Завершить проверку', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Подтвердить завершение', exact: true })
    .click();
  await expect(
    page.getByText('Проверка завершена. Результат доступен только для просмотра.', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('Результат', { exact: true }).selectOption('missing');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText(firstName!);
  await expect(page.getByRole('button', { name: 'На месте', exact: true })).toHaveCount(0);
  await page.reload();
  await expect(summary).toContainText('Отсутствует: 1');
  for (const width of [360, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  }
  await page.goto('/app/inventory');
  await page.getByLabel('Статус', { exact: true }).selectOption('completed');
  await page.getByLabel('Поиск', { exact: true }).fill(String(check.number));
  await expect(page.locator('tbody tr').filter({ hasText: `№${check.number}` })).toContainText(
    'Завершена',
  );
  const teacherContext = await browser.newContext();
  const teacher = await teacherContext.newPage();
  await teacher.goto('/login');
  await teacher.getByLabel('Email').fill('teacher@college.test');
  await teacher.getByLabel('Пароль', { exact: true }).fill(process.env.SEED_PASSWORD!);
  await teacher.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(teacher).toHaveURL(/\/app\/equipment$/u);
  await expect(teacher.locator('nav a[href="/app/inventory"]')).toHaveCount(0);
  await teacher.goto(`/app/inventory/${check.id}`);
  await expect(
    teacher.getByRole('heading', { name: 'Раздел недоступен для этой роли', exact: true }),
  ).toBeVisible();
  await teacherContext.close();
});
