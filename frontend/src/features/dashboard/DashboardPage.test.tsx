import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearSession } from '../../api/client';
import { renderApp } from '../../test/renderApp';

const summary = {
  generatedAt: '2026-10-21T12:00:00Z',
  scope: 'own',
  totalEquipment: 9,
  equipment: { available: 5, issued: 2, repair: 1, written_off: 1 },
  rooms: 2,
  activeLoans: 2,
  overdueLoans: 1,
  pendingRequests: 3,
  latestRequests: [
    {
      id: 'request',
      number: 10,
      status: 'pending',
      createdAt: '2026-10-21T10:00:00Z',
      requester: { id: 'me', name: 'Самир' },
      items: [
        { equipment: { id: 'item', name: '<script>Монитор</script>', inventoryNumber: 'INV' } },
      ],
    },
  ],
  overdue: [
    {
      id: 'loan',
      number: 5,
      dueAt: '2026-10-20T10:00:00Z',
      recipient: { id: 'me', name: 'Самир' },
      items: [{ equipment: { id: 'item', name: 'Проектор', inventoryNumber: 'INV2' } }],
    },
  ],
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
function mock(mode: 'success' | 'empty' | 'error' = 'success') {
  let failed = false;
  return vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      if (path === '/api/auth/refresh') return json({ data: { accessToken: 'token' } });
      if (path === '/api/me')
        return json({
          data: {
            id: 'me',
            name: 'Самир',
            email: 'me@college.test',
            role: 'teacher',
            isBlocked: false,
          },
        });
      if (path !== '/api/dashboard') throw new Error(`Unexpected request ${path}`);
      if (mode === 'error' && !failed) {
        failed = true;
        return json({ error: { code: 'REQUEST_FAILED' } }, 500);
      }
      return json({
        data:
          mode === 'empty'
            ? {
                ...summary,
                totalEquipment: 0,
                equipment: { available: 0, issued: 0, repair: 0, written_off: 0 },
                rooms: 0,
                activeLoans: 0,
                overdueLoans: 0,
                pendingRequests: 0,
                latestRequests: [],
                overdue: [],
              }
            : summary,
      });
    }),
  );
}
afterEach(() => {
  clearSession();
  vi.unstubAllGlobals();
});
describe('Live dashboard', () => {
  it('shows actual counters, safe record text, chart values and links', async () => {
    mock();
    renderApp('/app/overview');
    const strip = await screen.findByRole('region', { name: 'Сводка' });
    expect(within(strip).getByText('9')).toBeVisible();
    expect(
      screen.getByText('Заявки и выдачи — только ваши. Оборудование — весь фонд колледжа.'),
    ).toBeVisible();
    expect(screen.getByText('<script>Монитор</script>')).toBeVisible();
    expect(screen.getByRole('progressbar', { name: 'Доступно' })).toHaveAttribute('value', '5');
    expect(screen.getByRole('link', { name: /Все заявки/ })).toHaveAttribute(
      'href',
      '/app/requests',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Язык интерфейса' }));
    expect(screen.getByRole('heading', { name: 'Equipment status' })).toBeVisible();
  });
  it('handles zero counts and empty lists without invalid chart values', async () => {
    mock('empty');
    renderApp('/app/overview');
    const bar = await screen.findByRole('progressbar', { name: 'Доступно' });
    expect(bar).toHaveAttribute('max', '1');
    expect(bar).toHaveAttribute('value', '0');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
  it('retries a failed request without showing demonstration data', async () => {
    mock('error');
    renderApp('/app/overview');
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Сводка' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(await screen.findByRole('region', { name: 'Сводка' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Обновить список' }));
    expect(await screen.findByRole('region', { name: 'Сводка' })).toBeVisible();
  });
});
