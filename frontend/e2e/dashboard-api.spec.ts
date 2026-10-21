import { expect, test } from '@playwright/test';

test('dashboard agrees with API, refreshes and works in both languages and themes', async ({
  page,
}, info) => {
  test.skip(
    process.env.RUN_API_TESTS !== '1' || !process.env.SEED_PASSWORD,
    'Requires API and seeded accounts',
  );
  await page.goto('/login');
  await page.getByLabel('Email').fill('teacher@college.test');
  await page.getByLabel('Пароль', { exact: true }).fill(process.env.SEED_PASSWORD!);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/equipment$/u);
  const response = page.waitForResponse(
    (r) => r.url().endsWith('/api/dashboard') && r.status() === 200,
  );
  await page.locator('nav a[href="/app/overview"]').click();
  const { data } = await (await response).json();
  expect(data.scope).toBe('own');
  await expect(page.getByRole('region', { name: 'Сводка' })).toBeVisible();
  const numbers = await page.locator('.stats-strip .stat > strong').allTextContents();
  expect(numbers).toEqual(
    [data.totalEquipment, data.equipment.available, data.activeLoans, data.pendingRequests].map(
      String,
    ),
  );
  for (const width of [360, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: 960 });
    if (width <= 1024) await expect(page.locator('.sidebar')).not.toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: info.outputPath(`dashboard-${width}.png`),
      fullPage: true,
      animations: 'disabled',
    });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Язык интерфейса' }).click();
  await expect(page.getByRole('heading', { name: 'Equipment status' })).toBeVisible();
  await page.getByRole('button', { name: 'Appearance' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: info.outputPath('dashboard-dark-en.png'), fullPage: true });
  const refreshed = page.waitForResponse(
    (r) => r.url().endsWith('/api/dashboard') && r.status() === 200,
  );
  await page.getByRole('button', { name: 'Refresh list' }).click();
  await refreshed;
  await expect(page.getByRole('region', { name: 'Summary' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Summary' })).toBeVisible();
});
