import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../../test/renderApp';

describe('Directory and people forms', () => {
  it('rejects duplicate room numbers and preserves rooms linked to equipment', async () => {
    const user = userEvent.setup();
    renderApp('/rooms');
    await user.click(screen.getByRole('button', { name: '+ Добавить аудиторию' }));
    let dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText('Номер аудитории'), '204');
    await user.type(dialog.getByLabelText('Название'), 'Новая аудитория');
    await user.type(dialog.getByLabelText('Расположение'), 'Корпус Б');
    await user.click(dialog.getByRole('button', { name: 'Сохранить' }));
    expect(dialog.getByRole('alert')).toHaveTextContent('Аудитория с таким номером уже существует');
    await user.click(dialog.getByRole('button', { name: 'Отмена' }));
    await user.click(screen.getByRole('button', { name: 'Удалить' }));
    dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: 'Удалить' }));
    expect(dialog.getByRole('alert')).toHaveTextContent('Запись связана с оборудованием');
    expect(screen.getByRole('heading', { name: 'Аудитория 204' })).toBeInTheDocument();
  });

  it('adds a category to equipment forms and only deletes unlinked categories', async () => {
    const user = userEvent.setup();
    renderApp('/administration');
    await user.click(screen.getByRole('tab', { name: 'Категории' }));
    await user.click(screen.getByRole('button', { name: '+ Добавить категорию' }));
    let dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText('Название'), 'Компьютеры');
    await user.click(dialog.getByRole('button', { name: 'Сохранить' }));
    expect(dialog.getByRole('alert')).toHaveTextContent(
      'Категория с таким названием уже существует',
    );
    await user.clear(dialog.getByLabelText('Название'));
    await user.type(dialog.getByLabelText('Название'), 'Планшеты');
    await user.click(dialog.getByRole('button', { name: 'Сохранить' }));
    await user.click(screen.getByRole('link', { name: 'Оборудование' }));
    expect(screen.getByRole('option', { name: 'Планшеты' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Администрирование' }));
    await user.click(screen.getByRole('tab', { name: 'Категории' }));
    await user.click(screen.getByRole('button', { name: 'Удалить: Компьютеры' }));
    dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: 'Удалить' }));
    expect(dialog.getByRole('alert')).toHaveTextContent('Запись связана с оборудованием');
    await user.click(dialog.getByRole('button', { name: 'Отмена' }));
    await user.click(screen.getByRole('button', { name: 'Удалить: Планшеты' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить' }));
    expect(screen.queryByRole('button', { name: 'Удалить: Планшеты' })).not.toBeInTheDocument();
  });

  it('protects the last administrator and rejects a duplicate email', async () => {
    const user = userEvent.setup();
    renderApp('/administration');
    await user.click(screen.getByRole('button', { name: 'Изменить: Самир' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.selectOptions(dialog.getByLabelText('Роль'), 'TEACHER');
    await user.click(dialog.getByRole('button', { name: 'Сохранить' }));
    expect(dialog.getByRole('alert')).toHaveTextContent(
      'Нельзя отключить последнего активного администратора',
    );
    await user.selectOptions(dialog.getByLabelText('Роль'), 'ADMIN');
    await user.clear(dialog.getByLabelText('Email'));
    await user.type(dialog.getByLabelText('Email'), 'ARTEM@college.test');
    await user.click(dialog.getByRole('button', { name: 'Сохранить' }));
    expect(dialog.getByRole('alert')).toHaveTextContent('Этот email уже используется');
  });

  it('keeps profile history after a name change and rejects someone else email', async () => {
    const user = userEvent.setup();
    renderApp('/profile');
    const name = screen.getByLabelText('Имя', { exact: true });
    const email = screen.getByLabelText('Email');
    await user.clear(email);
    await user.type(email, 'artem@college.test');
    await user.click(screen.getByRole('button', { name: 'Сохранить изменения' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Этот email уже используется');
    await user.clear(email);
    await user.type(email, 'samir@college.test');
    await user.clear(name);
    await user.type(name, 'Самир Самиров');
    await user.click(screen.getByRole('button', { name: 'Сохранить изменения' }));
    expect(screen.getByText('Создание · Epson EB-X49 · ИНВ-0042')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Самир Самиров' })).toBeInTheDocument();
  });
});
