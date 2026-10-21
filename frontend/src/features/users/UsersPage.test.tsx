import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearSession } from '../../api/client';
import { renderApp } from '../../test/renderApp';

const result = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const admin = {
  id: 'admin',
  name: 'Администратор',
  email: 'admin@college.test',
  role: 'admin',
  isBlocked: false,
  isLastAdmin: true,
};
afterEach(() => {
  clearSession();
  vi.unstubAllGlobals();
});
function mock(role: string, last: boolean, fail = false) {
  const paths: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, options: RequestInit) => {
      paths.push(path);
      if (path === '/api/auth/refresh') return result({ data: { accessToken: 'token' } });
      if (path === '/api/me') return result({ data: { ...admin, role } });
      if (options.method === 'PATCH' && fail) return result({ error: { code: 'LAST_ADMIN' } }, 409);
      return result({
        data: [{ ...admin, id: 'target', isLastAdmin: last }],
        total: 1,
        page: 1,
        pageSize: 7,
      });
    }),
  );
  return paths;
}

describe('User administration', () => {
  it('disables role changes and blocking for the last active administrator', async () => {
    const user = userEvent.setup();
    mock('admin', true);
    renderApp('/app/users');
    await user.click(await screen.findByRole('button', { name: 'Изменить доступ: Администратор' }));
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByRole('combobox', { name: 'Роль' })).toBeDisabled();
    expect(dialog.getByRole('checkbox', { name: 'Заблокировать аккаунт' })).toBeDisabled();
    expect(dialog.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
    expect(
      dialog.getByText('Нельзя отключить последнего активного администратора'),
    ).toBeInTheDocument();
  });

  it('keeps a failed update open without changing the visible account', async () => {
    const user = userEvent.setup();
    mock('admin', false, true);
    renderApp('/app/users');
    await user.click(await screen.findByRole('button', { name: 'Изменить доступ: Администратор' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.selectOptions(dialog.getByRole('combobox', { name: 'Роль' }), 'teacher');
    await user.click(dialog.getByRole('button', { name: 'Сохранить' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent(
      'последнего активного администратора',
    );
    expect(screen.queryByText('Доступ пользователя обновлён')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not request users or display the menu for a technician', async () => {
    const paths = mock('technician', false);
    renderApp('/app/users');
    expect(
      await screen.findByRole('heading', { name: 'Раздел недоступен для этой роли' }),
    ).toBeInTheDocument();
    expect(paths.some((path) => path.startsWith('/api/users'))).toBe(false);
    expect(screen.queryByRole('link', { name: 'Пользователи' })).not.toBeInTheDocument();
  });
});
