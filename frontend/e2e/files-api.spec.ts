import { expect, test } from '@playwright/test';

test('staff upload persists, teacher downloads exact bytes and staff confirm deletion', async ({
  browser,
  page,
}) => {
  test.skip(
    process.env.RUN_API_TESTS !== '1' || !process.env.SEED_PASSWORD,
    'Requires API and seeded accounts',
  );
  const filename = `photo-${crypto.randomUUID().slice(0, 8)}.png`;
  const bytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7V0AAAAASUVORK5CYII=',
    'base64',
  );
  await page.goto('/login');
  await page.getByLabel('Email').fill('technician@college.test');
  await page.getByLabel('Пароль', { exact: true }).fill(process.env.SEED_PASSWORD!);
  await page.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/equipment$/u);
  await page
    .getByRole('button', { name: /^Открыть:/u })
    .first()
    .click();
  let dialog = page.getByRole('dialog');
  const heading = await dialog.getByRole('heading', { level: 2 }).textContent();
  await dialog
    .getByLabel('Прикрепить фото или документ')
    .setInputFiles({ name: filename, mimeType: 'image/png', buffer: bytes });
  await dialog.getByRole('button', { name: 'Загрузить файл', exact: true }).click();
  await expect(dialog.getByText(filename, { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: `Открыть: ${heading}`, exact: true }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByText(filename, { exact: true })).toBeVisible();
  const teacherContext = await browser.newContext();
  const teacher = await teacherContext.newPage();
  await teacher.goto('/login');
  await teacher.getByLabel('Email').fill('teacher@college.test');
  await teacher.getByLabel('Пароль', { exact: true }).fill(process.env.SEED_PASSWORD!);
  await teacher.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(teacher).toHaveURL(/\/app\/equipment$/u);
  await teacher.getByRole('button', { name: `Открыть: ${heading}`, exact: true }).click();
  const teacherDialog = teacher.getByRole('dialog');
  await teacherDialog.getByLabel('Найти файл', { exact: true }).fill(filename);
  await expect(teacherDialog.getByRole('button', { name: 'Скачать', exact: true })).toHaveCount(1);
  expect(await teacherDialog.getByLabel('Прикрепить фото или документ').count()).toBe(0);
  const downloadPromise = teacher.waitForEvent('download');
  await teacherDialog.getByRole('button', { name: 'Скачать', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(filename);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks)).toEqual(bytes);
  await page.setViewportSize({ width: 360, height: 900 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await dialog.getByRole('button', { name: `Удалить: ${filename}`, exact: true }).click();
  await dialog.getByRole('button', { name: 'Удалить файл', exact: true }).click();
  await expect(dialog.getByText(filename, { exact: true })).toHaveCount(0);
  await teacher.reload();
  await teacher.getByRole('button', { name: `Открыть: ${heading}`, exact: true }).click();
  await expect(teacher.getByRole('dialog').getByText(filename, { exact: true })).toHaveCount(0);
  await teacherContext.close();
});
