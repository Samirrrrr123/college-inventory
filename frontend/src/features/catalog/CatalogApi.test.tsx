import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession } from '../../api/client';
import { renderApp } from '../../test/renderApp';

const category = { id: 'category-1', name: 'Техника' };
const room = { id: 'room-1', number: '101', name: 'Кабинет', building: 'Корпус', floor: 0 };
const record = (name: string) => ({
  id: name,
  name,
  inventoryNumber: 'INV-1',
  serialNumber: null,
  description: '',
  categoryId: category.id,
  roomId: room.id,
  status: 'available',
  category,
  room,
  createdAt: '2026-10-20T12:00:00Z',
  updatedAt: '2026-10-20T12:00:00Z',
});
const result = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const list = (name: string) => result({ data: [record(name)], total: 1, page: 1, pageSize: 7 });

function mockApi(equipment: (url: URL) => Promise<Response> | Response) {
  const requests: URL[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      const url = new URL(path, 'http://localhost');
      requests.push(url);
      if (url.pathname === '/api/auth/refresh')
        return result({ data: { accessToken: 'teacher-token' } });
      if (url.pathname === '/api/me')
        return result({
          data: {
            id: 'teacher-1',
            name: 'Настоящий преподаватель',
            email: 'teacher@college.test',
            role: 'teacher',
            isBlocked: false,
          },
        });
      if (url.pathname === '/api/categories')
        return result({ data: [category], total: 1, page: 1, pageSize: 100 });
      if (url.pathname === '/api/rooms')
        return result({ data: [room], total: 1, page: 1, pageSize: 100 });
      return equipment(url);
    }),
  );
  return requests;
}
beforeEach(() => clearSession());
afterEach(() => {
  clearSession();
  vi.unstubAllGlobals();
});

describe('Live catalog', () => {
  it('uses the real account and server search results without filtering those results locally', async () => {
    const user = userEvent.setup();
    const requests = mockApi(() => list('Ответ сервера'));
    renderApp('/app/equipment');
    expect(await screen.findByText('Ответ сервера', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('Настоящий преподаватель')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Добавить' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Посмотреть как')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Поиск', { exact: true }), 'needle');
    await waitFor(() =>
      expect(
        requests.some(
          (url) => url.pathname === '/api/equipment' && url.searchParams.get('search') === 'needle',
        ),
      ).toBe(true),
    );
    expect(await screen.findByText('Ответ сервера', { exact: true })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Статус', { exact: true }), 'repair');
    await waitFor(() =>
      expect(
        requests.some(
          (url) =>
            url.searchParams.get('status') === 'repair' && url.searchParams.get('pageSize') === '7',
        ),
      ).toBe(true),
    );
  });
  it('shows an API failure instead of a fake empty list and retries the request', async () => {
    const user = userEvent.setup();
    let failed = true;
    mockApi(() =>
      failed ? result({ error: { code: 'INTERNAL_ERROR' } }, 503) : list('После повтора'),
    );
    renderApp('/app/equipment');
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось выполнить запрос');
    expect(screen.queryByRole('heading', { name: 'Ничего не найдено' })).not.toBeInTheDocument();
    failed = false;
    await user.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(await screen.findByText('После повтора', { exact: true })).toBeInTheDocument();
  });
  it('ignores an older search response that arrives after the latest response', async () => {
    const user = userEvent.setup();
    let resolveOld: ((response: Response) => void) | undefined;
    const requests = mockApi((url) =>
      url.searchParams.get('search') === 'old'
        ? new Promise<Response>((resolve) => {
            resolveOld = resolve;
          })
        : list(url.searchParams.get('search') === 'new' ? 'Свежий результат' : 'Исходный список'),
    );
    renderApp('/app/equipment');
    await screen.findByText('Исходный список', { exact: true });
    const search = screen.getByLabelText('Поиск', { exact: true });
    await user.type(search, 'old');
    await waitFor(() => expect(resolveOld).toBeDefined());
    await user.clear(search);
    await user.type(search, 'new');
    expect(await screen.findByText('Свежий результат', { exact: true })).toBeInTheDocument();
    resolveOld!(list('Устаревший результат'));
    await waitFor(() =>
      expect(requests.some((url) => url.searchParams.get('search') === 'new')).toBe(true),
    );
    expect(screen.queryByText('Устаревший результат')).not.toBeInTheDocument();
    expect(screen.getByText('Свежий результат', { exact: true })).toBeInTheDocument();
  });
});
