import { expect, test } from '@playwright/test';

test('rooms, categories and people can be managed in the demo', async ({ page }) => {
  await page.goto('/rooms');
  await page.getByRole('button', { name: '+ Добавить аудиторию' }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Номер аудитории').fill('999');
  await dialog.getByLabel('Название').fill('Учебная мастерская');
  await dialog.getByLabel('Расположение').fill('Корпус Б, 1 этаж');
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.getByRole('button', { name: /999 Учебная мастерская/ }).click();
  await expect(page.getByRole('heading', { name: 'Аудитория 999' })).toBeVisible();
  await page.getByRole('button', { name: 'Удалить', exact: true }).click();
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Аудитория 999' })).toBeVisible();
  await page.getByRole('button', { name: 'Удалить', exact: true }).click();
  await dialog.getByRole('button', { name: 'Удалить', exact: true }).click();
  await expect(page.getByRole('button', { name: /999 Учебная мастерская/ })).toHaveCount(0);

  await page.goto('/administration');
  await page.getByRole('tab', { name: 'Категории' }).click();
  await page.getByRole('button', { name: '+ Добавить категорию' }).click();
  await dialog.getByLabel('Название').fill('Планшеты');
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.getByRole('button', { name: 'Изменить: Планшеты' }).click();
  await dialog.getByLabel('Название').fill('Учебные планшеты');
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.getByRole('link', { name: 'Оборудование', exact: true }).click();
  await expect(page.getByRole('option', { name: 'Учебные планшеты' })).toHaveCount(1);

  await page.getByRole('link', { name: 'Администрирование', exact: true }).click();
  await page.getByRole('button', { name: '+ Добавить пользователя' }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Имя', { exact: true }).fill('Тестовый пользователь');
  await dialog.getByLabel('Email').fill('test.person@college.test');
  await dialog.getByLabel('Роль').selectOption('LAB_ASSISTANT');
  await dialog.getByRole('checkbox', { name: 'Заблокировать аккаунт' }).check();
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('row', { name: /Тестовый пользователь/ })).toContainText(
    'Заблокирован',
  );
  await page.getByRole('button', { name: 'Изменить: Тестовый пользователь' }).click();
  await dialog.getByRole('checkbox', { name: 'Заблокировать аккаунт' }).uncheck();
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByRole('row', { name: /Тестовый пользователь/ })).toContainText('Активен');
});

test('a teacher requests a whole set and staff issue and return it together', async ({ page }) => {
  await page.goto('/requests');
  await page.getByLabel('Посмотреть как').selectOption('elena');
  await page.getByRole('button', { name: 'Новая заявка', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Для чего нужно оборудование').fill('Лабораторное занятие');
  await dialog.getByRole('checkbox', { name: /Акустическая система JBL/ }).check();
  await dialog.getByRole('checkbox', { name: /Веб-камера Logitech C920/ }).check();
  await dialog.getByRole('button', { name: 'Отправить заявку' }).click();
  await page.getByLabel('Посмотреть как').selectOption('samir');
  await page.getByRole('button', { name: 'Рассмотреть: ЗЯ-0019' }).click();
  await dialog.getByRole('button', { name: 'Одобрить', exact: true }).click();
  await page.getByRole('button', { name: 'Рассмотреть: ЗЯ-0019' }).click();
  await dialog.getByRole('button', { name: 'Оформить выдачу', exact: true }).click();
  await expect(dialog.getByRole('checkbox', { checked: true })).toHaveCount(2);
  await dialog.getByLabel('Вернуть до').fill('2099-10-25');
  await dialog.getByRole('button', { name: 'Оформить выдачу', exact: true }).click();
  const loan = page.getByRole('row', { name: /ВД-0049/ });
  await expect(loan).toContainText('Акустическая система JBL');
  await expect(loan).toContainText('Веб-камера Logitech C920');
  await page.getByRole('link', { name: 'Оборудование', exact: true }).click();
  await page.getByLabel('Поиск', { exact: true }).fill('Акустическая система JBL');
  await expect(page.getByRole('row', { name: /Акустическая система JBL/ })).toContainText('Выдано');
  await page.getByRole('link', { name: 'Заявки и выдачи', exact: true }).click();
  await page.getByRole('tab', { name: 'Активные выдачи' }).click();
  await page.getByRole('button', { name: 'Принять возврат: ВД-0049' }).click();
  await expect(dialog).toContainText('Акустическая система JBL');
  await expect(dialog).toContainText('Веб-камера Logitech C920');
  await dialog.getByRole('button', { name: 'Подтвердить', exact: true }).click();
  await expect(page.getByRole('row', { name: /ВД-0049/ })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Возвраты' }).click();
  await expect(page.getByRole('row', { name: /ВД-0049/ })).toContainText(
    'Веб-камера Logitech C920',
  );
  await page.getByRole('link', { name: 'Оборудование', exact: true }).click();
  for (const name of ['Акустическая система JBL', 'Веб-камера Logitech C920']) {
    await page.getByLabel('Поиск', { exact: true }).fill(name);
    await expect(page.getByRole('row', { name: new RegExp(name) })).toContainText('Доступно');
  }
});

test('management dialogs fit a narrow screen in English and dark mode', async ({ page }) => {
  await page.goto('/profile');
  await page.getByRole('radio', { name: 'Тёмная' }).check();
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.setViewportSize({ width: 360, height: 900 });
  const screens = [
    { path: '/rooms', button: '+ Add room' },
    { path: '/administration', button: '+ Add person' },
    { path: '/profile', button: 'Change password' },
    { path: '/requests', button: 'Issue equipment' },
  ];
  for (const screen of screens) {
    await page.goto(screen.path);
    await page.getByRole('button', { name: screen.button, exact: true }).click();
    const dialog = page.getByRole('dialog');
    const bounds = await dialog.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(360);
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).toHaveCount(0);
  }
  await page.goto('/administration');
  await page.getByRole('tab', { name: 'Categories', exact: true }).click();
  await page.getByRole('button', { name: '+ Add category' }).click();
  await page.getByRole('dialog').getByLabel('Name', { exact: true }).fill('Tablets');
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit: Tablets' })).toBeVisible();
});
