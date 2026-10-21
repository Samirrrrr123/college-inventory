import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearSession } from '../../api/client';
import { renderApp } from '../../test/renderApp';

const result = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const room = { id: 'room-a', number: '101', name: 'Кабинет', building: 'Корпус', floor: 1 };
const movement = {
  id: 'move-a',
  equipmentId: 'equipment-a',
  fromRoomId: room.id,
  toRoomId: 'room-b',
  actorId: 'actor',
  reason: '<img src=x onerror=alert(1)>',
  createdAt: '2026-01-20T12:00:00.000Z',
  actor: { id: 'actor', name: 'Лаборант' },
  equipment: { id: 'equipment-a', name: 'Учебный монитор', inventoryNumber: 'INV-001' },
  fromRoom: room,
  toRoom: { ...room, id: 'room-b', number: '102' },
};
const audit = {
  id: 'audit-a',
  actorId: 'actor',
  actor: { id: 'actor', name: 'Лаборант' },
  action: 'equipmentUpdated',
  entityType: 'equipment',
  entityId: 'equipment-a',
  subject: 'INV-001 · Учебный монитор',
  details: { changes: { description: '<script>alert(1)</script>' } },
  createdAt: movement.createdAt,
};
afterEach(() => {
  clearSession();
  vi.unstubAllGlobals();
});
function mock(role: string, fail = false) {
  const paths: string[] = [];
  let failed = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      paths.push(path);
      if (path === '/api/auth/refresh') return result({ data: { accessToken: 'token' } });
      if (path === '/api/me')
        return result({
          data: {
            id: 'current',
            name: 'Пользователь',
            email: 'user@college.test',
            role,
            isBlocked: false,
          },
        });
      const url = new URL(path, 'http://localhost');
      if (url.pathname === '/api/rooms')
        return result({
          data: [room, { ...room, id: 'room-b', number: '102' }],
          total: 2,
          page: 1,
          pageSize: 100,
        });
      if (fail && !failed) {
        failed = true;
        return result({ error: { code: 'REQUEST_FAILED' } }, 500);
      }
      const page = Number(url.searchParams.get('page') ?? 1);
      return result({
        data: [
          url.pathname === '/api/audit'
            ? audit
            : {
                ...movement,
                equipment: {
                  ...movement.equipment,
                  name: page === 2 ? 'Вторая страница' : movement.equipment.name,
                },
              },
        ],
        total: 11,
        page,
        pageSize: 10,
      });
    }),
  );
  return paths;
}
const historyPath = (paths: string[], kind = 'movements') =>
  paths.filter((path) => path.startsWith(`/api/${kind}?`)).at(-1)!;

describe('Live history pages', () => {
  it.each([
    ['teacher', 'movements'],
    ['teacher', 'audit'],
    ['technician', 'audit'],
  ])('denies %s access to %s without requesting protected data', async (role, kind) => {
    const paths = mock(role);
    renderApp(`/app/${kind}`);
    expect(
      await screen.findByRole('heading', { name: 'Раздел недоступен для этой роли' }),
    ).toBeInTheDocument();
    expect(paths.some((path) => path.startsWith(`/api/${kind}`))).toBe(false);
    expect(screen.queryByRole('link', { name: 'Журнал аудита' })).not.toBeInTheDocument();
    if (role === 'teacher')
      expect(screen.queryByRole('link', { name: 'Перемещения' })).not.toBeInTheDocument();
  });

  it('loads movements from API, changes pages and sends filters to the server', async () => {
    const user = userEvent.setup();
    const paths = mock('technician');
    renderApp('/app/movements');
    expect(await screen.findByText('Учебный монитор')).toBeInTheDocument();
    expect(screen.getByText(movement.reason)).toBeInTheDocument();
    expect(document.querySelector('img[onerror]')).toBeNull();
    expect(screen.getByRole('link', { name: 'Перемещения' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Следующая страница' }));
    expect(await screen.findByText('Вторая страница')).toBeInTheDocument();
    expect(new URL(historyPath(paths), 'http://localhost').searchParams.get('page')).toBe('2');
    await user.type(screen.getByLabelText('Поиск', { exact: true }), 'INV-001');
    await waitFor(() =>
      expect(new URL(historyPath(paths), 'http://localhost').searchParams.get('search')).toBe(
        'INV-001',
      ),
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Откуда' }), 'room-a');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Куда' }), 'room-b');
    await waitFor(() =>
      expect(new URL(historyPath(paths), 'http://localhost').searchParams.get('toRoomId')).toBe(
        'room-b',
      ),
    );
    const query = new URL(historyPath(paths), 'http://localhost').searchParams;
    expect(query.get('page')).toBe('1');
    expect(query.get('fromRoomId')).toBe('room-a');
    await user.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));
    await waitFor(() =>
      expect(new URL(historyPath(paths), 'http://localhost').searchParams.has('search')).toBe(
        false,
      ),
    );
    expect(screen.getByRole('combobox', { name: 'Откуда' })).toHaveValue('');
  });

  it('loads global audit for admin with localized actions, safe details and date filters', async () => {
    const user = userEvent.setup();
    const paths = mock('admin');
    renderApp('/app/audit');
    expect(await screen.findByText('INV-001 · Учебный монитор')).toBeInTheDocument();
    const table = within(screen.getByRole('table'));
    expect(table.getByText('Оборудование изменено')).toBeInTheDocument();
    await user.click(table.getByText('Сведения', { selector: 'summary' }));
    expect(table.getByText(/<script>alert\(1\)<\/script>/u)).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Действие' }),
      'equipmentUpdated',
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Тип объекта' }), 'equipment');
    fireEvent.change(screen.getByLabelText('Дата с (UTC)'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Дата по (UTC)'), { target: { value: '2026-01-20' } });
    await waitFor(() =>
      expect(new URL(historyPath(paths, 'audit'), 'http://localhost').searchParams.get('to')).toBe(
        '2026-01-20T23:59:59.999Z',
      ),
    );
    const query = new URL(historyPath(paths, 'audit'), 'http://localhost').searchParams;
    expect(query.get('action')).toBe('equipmentUpdated');
    expect(query.get('entityType')).toBe('equipment');
    expect(query.get('from')).toBe('2026-01-01T00:00:00.000Z');
    expect(paths.some((path) => path.startsWith('/api/users'))).toBe(false);
  });

  it('shows an invalid date interval locally without sending it to API', async () => {
    const paths = mock('admin');
    renderApp('/app/audit');
    await screen.findByText('INV-001 · Учебный монитор');
    fireEvent.change(screen.getByLabelText('Дата с (UTC)'), { target: { value: '2026-02-01' } });
    fireEvent.change(screen.getByLabelText('Дата по (UTC)'), { target: { value: '2026-01-01' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Начало периода');
    expect(
      paths.filter((path) => path.includes('from=2026-02-01') && path.includes('to=2026-01-01')),
    ).toHaveLength(0);
  });

  it('shows a server failure and retries the same list successfully', async () => {
    const user = userEvent.setup();
    mock('admin', true);
    renderApp('/app/audit');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(await screen.findByText('INV-001 · Учебный монитор')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
