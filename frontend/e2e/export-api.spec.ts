import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('staff downloads a real filtered XLSX in both languages and teacher is denied', async ({
  page,
  browser,
}, info) => {
  test.skip(
    process.env.RUN_API_TESTS !== '1' || !process.env.SEED_PASSWORD,
    'Requires API and seeded accounts',
  );
  await page.goto('/login');
  await page.getByLabel('Email').fill('technician@college.test');
  await page.getByLabel('Пароль', { exact: true }).fill(process.env.SEED_PASSWORD!);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/equipment$/u);
  await expect(page.locator('.catalog-panel')).toHaveAttribute('aria-busy', 'false');
  await page.getByLabel('Статус', { exact: true }).selectOption('repair');
  await expect(page.locator('.catalog-panel')).toHaveAttribute('aria-busy', 'false');
  const request = page.waitForResponse((r) => r.url().includes('/api/equipment/export?'));
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачать XLSX' }).click();
  const response = await request;
  expect(response.status()).toBe(200);
  const params = new URL(response.url()).searchParams;
  expect(params.get('status')).toBe('repair');
  expect(params.has('page')).toBe(false);
  const file = await download;
  expect(file.suggestedFilename()).toBe('equipment.xlsx');
  await file.saveAs(info.outputPath('equipment-ru.xlsx'));
  const bytes = await readFile(info.outputPath('equipment-ru.xlsx'));
  expect(bytes.subarray(0, 2).toString()).toBe('PK');
  await page.getByRole('button', { name: 'Язык интерфейса' }).click();
  const english = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download XLSX' }).click();
  await (await english).saveAs(info.outputPath('equipment-en.xlsx'));
  for (const width of [360, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 960 });
    if (width <= 1024) await expect(page.locator('.sidebar')).not.toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: info.outputPath(`export-${width}.png`),
      fullPage: true,
      animations: 'disabled',
    });
  }
  const context = await browser.newContext();
  try {
    const teacher = await context.newPage();
    await teacher.goto('/login');
    await teacher.getByLabel('Email').fill('teacher@college.test');
    await teacher.getByLabel('Пароль', { exact: true }).fill(process.env.SEED_PASSWORD!);
    await teacher.getByRole('button', { name: 'Войти', exact: true }).click();
    await expect(teacher).toHaveURL(/\/app\/equipment$/u);
    await expect(teacher.locator('.catalog-panel')).toHaveAttribute('aria-busy', 'false');
    await expect(teacher.getByRole('button', { name: 'Скачать XLSX' })).toHaveCount(0);
    const origin = new URL(teacher.url()).origin;
    const login = await teacher.request.post('/api/auth/login', {
      headers: { Origin: origin },
      data: { email: 'teacher@college.test', password: process.env.SEED_PASSWORD },
    });
    const token = (await login.json()).data.accessToken as string;
    const denied = await teacher.request.get('/api/equipment/export', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(denied.status()).toBe(403);
  } finally {
    await context.close();
  }
});
