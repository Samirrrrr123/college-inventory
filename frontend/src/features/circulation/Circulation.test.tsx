import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession } from '../../api/client';
import { renderApp } from '../../test/renderApp';

const items = Array.from({ length: 9 }, (_, index) => ({
  id: `equipment-${index}`,
  name: `Предмет ${index + 1}`,
  inventoryNumber: `INV-${index + 1}`,
  status: 'available',
}));
const record = {
  id: 'request-1',
  number: 1,
  requesterId: 'person-1',
  requester: { id: 'person-1', name: 'Преподаватель', email: 'teacher@college.test' },
  purpose: 'Занятие',
  status: 'approved',
  decisionNote: '',
  createdAt: '2026-10-21T10:00:00Z',
  reviewedAt: null,
  reviewer: null,
  items: items.slice(0, 2).map((equipment) => ({ equipmentId: equipment.id, equipment })),
  loan: null,
};
const result = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
function mockApi(role = 'teacher', requests: unknown[] = []) {
  const posts: { path: string; body: unknown }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string, init?: RequestInit) => {
      const url = new URL(path, 'http://localhost');
      if (url.pathname === '/api/auth/refresh')
        return result({ data: { accessToken: 'circulation-token' } });
      if (url.pathname === '/api/me')
        return result({
          data: {
            id: 'person-1',
            name: 'Преподаватель',
            email: 'teacher@college.test',
            role,
            isBlocked: false,
          },
        });
      if (init?.method === 'POST') {
        posts.push({ path: url.pathname, body: JSON.parse(String(init.body)) });
        if (url.pathname === '/api/loans')
          return result({ error: { code: 'EQUIPMENT_UNAVAILABLE', message: 'Unavailable' } }, 409);
        return result({ data: record }, 201);
      }
      if (url.pathname === '/api/equipment') {
        const page = Number(url.searchParams.get('page') ?? 1);
        return result({
          data: items.slice((page - 1) * 8, page * 8),
          total: items.length,
          page,
          pageSize: 8,
        });
      }
      return result({ data: requests, total: requests.length, page: 1, pageSize: 7 });
    }),
  );
  return posts;
}
beforeEach(() => clearSession());
afterEach(() => {
  clearSession();
  vi.unstubAllGlobals();
});

describe('Live circulation forms', () => {
  it('validates purpose and equipment before sending a request', async () => {
    const user = userEvent.setup();
    const posts = mockApi();
    renderApp('/app/requests');
    await user.click(await screen.findByRole('button', { name: 'Новая заявка' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByRole('button', { name: 'Отправить заявку' }));
    expect(dialog.getByRole('alert')).toHaveTextContent('Укажите');
    await user.type(dialog.getByLabelText('Для чего нужно оборудование'), 'Занятие');
    await user.click(dialog.getByRole('button', { name: 'Отправить заявку' }));
    expect(dialog.getByRole('alert')).toHaveTextContent('Выберите');
    expect(posts).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Выдача без заявки' })).not.toBeInTheDocument();
  });

  it('keeps equipment selected across server pages and sends only the selected IDs', async () => {
    const user = userEvent.setup();
    const posts = mockApi();
    renderApp('/app/requests');
    await user.click(await screen.findByRole('button', { name: 'Новая заявка' }));
    const dialog = within(screen.getByRole('dialog'));
    await user.type(dialog.getByLabelText('Для чего нужно оборудование'), 'Занятие');
    await user.click(await dialog.findByRole('checkbox', { name: /Предмет 1.*INV-1/u }));
    await user.click(dialog.getByRole('button', { name: 'Следующая страница' }));
    await user.click(await dialog.findByRole('checkbox', { name: /Предмет 9.*INV-9/u }));
    await user.click(dialog.getByRole('button', { name: 'Предыдущая страница' }));
    expect(await dialog.findByRole('checkbox', { name: /Предмет 1.*INV-1/u })).toBeChecked();
    await user.click(dialog.getByRole('button', { name: 'Отправить заявку' }));
    await waitFor(() =>
      expect(posts).toEqual([
        {
          path: '/api/requests',
          body: { purpose: 'Занятие', equipmentIds: ['equipment-0', 'equipment-8'] },
        },
      ]),
    );
  });

  it('keeps the issue dialog open when the server rejects an unavailable set', async () => {
    const user = userEvent.setup();
    mockApi('technician', [record]);
    renderApp('/app/requests');
    await user.click(await screen.findByRole('button', { name: 'Оформить выдачу' }));
    const dialog = within(screen.getByRole('dialog'));
    fireEvent.change(dialog.getByLabelText('Вернуть до'), { target: { value: '2030-01-01' } });
    await user.click(dialog.getByRole('button', { name: 'Оформить выдачу' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('недоступна');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
