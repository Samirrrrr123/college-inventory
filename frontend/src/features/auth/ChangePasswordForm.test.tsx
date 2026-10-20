import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../../test/renderApp';

describe('Password change form', () => {
  it('validates a different password and clears secrets without pretending to save them', async () => {
    const user = userEvent.setup();
    renderApp('/profile');
    await user.click(screen.getByRole('button', { name: 'Изменить пароль' }));
    const dialog = within(screen.getByRole('dialog'));
    const current = dialog.getByLabelText('Текущий пароль', { exact: true });
    const password = dialog.getByLabelText('Новый пароль', { exact: true });
    const confirmation = dialog.getByLabelText('Повторите пароль', { exact: true });
    await user.type(current, 'Current-123');
    await user.type(password, 'Current-123');
    await user.type(confirmation, 'Current-123');
    await user.click(dialog.getByRole('button', { name: 'Сохранить пароль' }));
    expect(dialog.getByRole('alert')).toHaveTextContent(
      'Новый пароль должен отличаться от текущего',
    );
    await user.clear(password);
    await user.clear(confirmation);
    await user.type(password, 'New-Example-456');
    await user.type(confirmation, 'New-Example-456');
    await user.click(dialog.getByRole('button', { name: 'Сохранить пароль' }));
    expect(dialog.getByRole('status')).toHaveTextContent('операция не выполнена');
    for (const input of [current, password, confirmation]) expect(input).toHaveValue('');
    expect(JSON.stringify(localStorage)).not.toContain('Current-123');
    expect(JSON.stringify(localStorage)).not.toContain('New-Example-456');
  });
});
