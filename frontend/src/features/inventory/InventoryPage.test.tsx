import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearSession } from '../../api/client';
import { renderApp } from '../../test/renderApp';

const result = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
afterEach(() => {
  clearSession();
  vi.unstubAllGlobals();
});
const check = {
  id: 'check-1',
  number: 1,
  createdAt: '2026-10-21T08:00:00Z',
  completedAt: null,
  room: { id: 'room-1', number: '101', building: 'Корпус', name: 'Кабинет' },
  createdBy: { id: 'staff', name: 'Лаборант' },
  completedBy: null,
  _count: { items: 1 },
  summary: { total: 1, found: 0, missing: 0, pending: 1 },
};
function session(path: string, role = 'technician') {
  if (path === '/api/auth/refresh') return result({ data: { accessToken: 'token' } });
  if (path === '/api/me')
    return result({
      data: { id: 'staff', name: 'Лаборант', email: 'staff@college.test', role, isBlocked: false },
    });
}

describe('Inventory checks', () => {
  it('keeps an unsuccessful mark unchecked and prevents early completion', async () => {
    const user = userEvent.setup();
    const mutations: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, options: RequestInit) => {
        const auth = session(path);
        if (auth) return auth;
        if (options.method === 'PATCH') {
          mutations.push(JSON.parse(options.body as string));
          return result({ error: { code: 'CONCURRENT_CHANGE' } }, 409);
        }
        if (path.includes('/items?'))
          return result({
            data: [
              {
                equipmentId: 'equipment-1',
                equipmentName: 'Монитор',
                inventoryNumber: 'INV-1',
                statusAtStart: 'available',
                found: null,
              },
            ],
            total: 1,
            page: 1,
            pageSize: 7,
          });
        return result({ data: check });
      }),
    );
    renderApp('/app/inventory/check-1');
    const mark = await screen.findByRole('button', { name: 'На месте' });
    expect(screen.getByRole('button', { name: 'Завершить проверку' })).toBeDisabled();
    await user.click(mark);
    await waitFor(() => expect(mutations).toEqual([{ found: true }]));
    expect(await screen.findByRole('alert')).toHaveTextContent('Запись была изменена');
    expect(screen.getByRole('button', { name: 'Завершить проверку' })).toBeDisabled();
  });

  it('does not request inventory records or show its menu to a teacher', async () => {
    const paths: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string) => {
        paths.push(path);
        return session(path, 'teacher') ?? result({ data: [] });
      }),
    );
    renderApp('/app/inventory/check-1');
    expect(
      await screen.findByRole('heading', { name: 'Раздел недоступен для этой роли' }),
    ).toBeInTheDocument();
    expect(paths.some((path) => path.includes('inventory-checks'))).toBe(false);
    expect(screen.queryByRole('link', { name: 'Инвентаризации' })).not.toBeInTheDocument();
  });
});
