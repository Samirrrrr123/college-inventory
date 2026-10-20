import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../../test/renderApp';

describe('Whole equipment set issue', () => {
  it('does not issue any part of a request if one item is already on loan', async () => {
    const user = userEvent.setup();
    renderApp('/requests');
    await user.selectOptions(screen.getByLabelText('Посмотреть как'), 'elena');
    await user.click(screen.getByRole('button', { name: 'Новая заявка' }));
    let dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText('Для чего нужно оборудование'), 'Учебное занятие');
    await user.click(dialog.getByRole('checkbox', { name: /Акустическая система JBL/ }));
    await user.click(dialog.getByRole('checkbox', { name: /Проектор Epson EB-X49/ }));
    await user.click(dialog.getByRole('button', { name: 'Отправить заявку' }));
    await user.selectOptions(screen.getByLabelText('Посмотреть как'), 'samir');
    await user.click(screen.getByRole('button', { name: 'Рассмотреть: ЗЯ-0019' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Одобрить' }));
    await user.click(screen.getByRole('button', { name: 'Рассмотреть: ЗЯ-0019' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Оформить выдачу' }),
    );
    dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText('Вернуть до'), '2099-10-25');
    await user.click(dialog.getByRole('button', { name: 'Оформить выдачу' }));
    expect(dialog.getByRole('alert')).toHaveTextContent('Комплект не выдан');
    await user.click(dialog.getByRole('button', { name: 'Отмена' }));
    await user.click(screen.getByRole('tab', { name: 'Активные выдачи' }));
    expect(screen.queryByText('ВД-0049')).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Оборудование' }));
    await user.type(screen.getByLabelText('Поиск'), 'Акустическая система JBL');
    const row = screen.getByRole('row', { name: /Акустическая система JBL/ });
    expect(within(row).getByText('Доступно')).toBeInTheDocument();
  });

  it('does not create a loan with a past return date', async () => {
    const user = userEvent.setup();
    renderApp('/requests');
    await user.click(screen.getByRole('button', { name: 'Оформить выдачу' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByRole('checkbox', { name: /Акустическая система JBL/ }));
    await user.type(dialog.getByLabelText('Вернуть до'), '2020-01-01');
    await user.click(dialog.getByRole('button', { name: 'Оформить выдачу' }));
    expect(dialog.getByRole('alert')).toHaveTextContent(
      'Укажите срок возврата не раньше сегодняшнего дня',
    );
  });
});
