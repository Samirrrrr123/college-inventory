import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../../test/renderApp';

describe('Authentication forms before API integration', () => {
  it('validates login fields and focuses the first error', async () => {
    const user = userEvent.setup();
    renderApp('/login');
    await user.click(screen.getByRole('button', { name: 'Войти' }));
    expect(screen.getAllByText('Заполните это поле')).toHaveLength(2);
    expect(screen.getByLabelText('Email')).toHaveFocus();
    await user.type(screen.getByLabelText('Email'), 'invalid-email');
    await user.click(screen.getByRole('button', { name: 'Войти' }));
    expect(screen.getByText('Введите корректный email')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('checks password confirmation and never creates a local account', async () => {
    const user = userEvent.setup();
    renderApp('/register');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Имя', { exact: true }), 'Анна');
    await user.type(screen.getByLabelText('Email'), 'anna@college.test');
    const password = screen.getByLabelText('Пароль', { exact: true });
    const confirmation = screen.getByLabelText('Повторите пароль', { exact: true });
    await user.type(password, 'Example-123');
    await user.type(confirmation, 'Different-123');
    await user.click(screen.getByRole('button', { name: 'Создать аккаунт' }));
    expect(screen.getByText('Пароли не совпадают')).toBeInTheDocument();
    expect(confirmation).toHaveFocus();
    await user.clear(confirmation);
    await user.type(confirmation, 'Example-123');
    await user.click(screen.getByRole('button', { name: 'Создать аккаунт' }));
    expect(screen.getByRole('status')).toHaveTextContent('операция не выполнена');
    expect(password).toHaveValue('');
    expect(confirmation).toHaveValue('');
    expect(JSON.stringify(localStorage)).not.toContain('Example-123');
    expect(JSON.stringify(localStorage)).not.toContain('anna@college.test');
    expect(JSON.stringify(sessionStorage)).not.toContain('Example-123');
  });

  it('clears a password when moving between public forms', async () => {
    const user = userEvent.setup();
    renderApp('/login');
    await user.type(screen.getByLabelText('Пароль', { exact: true }), 'Temporary-123');
    await user.click(screen.getByRole('button', { name: 'Показать пароль: Пароль' }));
    expect(screen.getByLabelText('Пароль', { exact: true })).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('link', { name: 'Забыли пароль?' }));
    await user.click(screen.getByRole('link', { name: 'Вернуться ко входу →' }));
    expect(screen.getByLabelText('Пароль', { exact: true })).toHaveValue('');
    expect(screen.getByLabelText('Пароль', { exact: true })).toHaveAttribute('type', 'password');
  });

  it('requires a reset code and checks a new password before API integration', async () => {
    const user = userEvent.setup();
    const app = renderApp('/reset-password');
    expect(screen.getByRole('alert')).toHaveTextContent('отсутствует код восстановления');
    expect(screen.queryByRole('button', { name: 'Сохранить пароль' })).not.toBeInTheDocument();
    app.unmount();
    renderApp('/reset-password?token=example-reset-code');
    await user.type(screen.getByLabelText('Новый пароль', { exact: true }), 'short');
    await user.type(screen.getByLabelText('Повторите пароль', { exact: true }), 'short');
    await user.click(screen.getByRole('button', { name: 'Сохранить пароль' }));
    expect(screen.getByText('Пароль должен содержать хотя бы 8 символов')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
