import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../../test/renderApp';

describe('Equipment catalog', () => {
  it('combines search with status filters and lets the user reset an empty result', async () => {
    const user = userEvent.setup();
    renderApp('/equipment');
    await user.type(screen.getByLabelText('Поиск'), 'Epson');
    expect(
      screen.getByRole('button', { name: 'Открыть: Проектор Epson EB-X49' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Открыть: Ноутбук Lenovo V15' }),
    ).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Статус'), 'AVAILABLE');
    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));
    expect(
      screen.getByRole('button', { name: 'Открыть: Акустическая система JBL' }),
    ).toBeInTheDocument();
  });

  it('keeps the form open and explains a duplicate inventory number', async () => {
    const user = userEvent.setup();
    renderApp('/equipment');
    await user.click(screen.getByRole('button', { name: '+ Добавить' }));
    const form = within(screen.getByRole('dialog'));
    await user.type(form.getByLabelText('Название *'), 'Тестовый проектор');
    await user.type(form.getByLabelText('Инвентарный номер *'), 'ИНВ-0042');
    await user.click(form.getByRole('button', { name: 'Сохранить' }));
    expect(form.getByRole('alert')).toHaveTextContent('Этот инвентарный номер уже используется');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not delete equipment with linked operations', async () => {
    const user = userEvent.setup();
    renderApp('/equipment');
    await user.type(screen.getByLabelText('Поиск'), 'Epson');
    await user.click(screen.getByRole('button', { name: 'Открыть: Проектор Epson EB-X49' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить' }));
    expect(screen.getByRole('status')).toHaveTextContent('Нельзя удалить оборудование');
    expect(
      screen.getByRole('button', { name: 'Открыть: Проектор Epson EB-X49' }),
    ).toBeInTheDocument();
  });
});
