import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearSession } from '../../api/client';
import { renderApp } from '../../test/renderApp';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
function mock(role: string, fail = false) {
  const paths: URL[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      const url = new URL(path, 'http://localhost');
      paths.push(url);
      if (url.pathname === '/api/auth/refresh') return json({ data: { accessToken: 'token' } });
      if (url.pathname === '/api/me')
        return json({
          data: { id: 'me', name: 'Самир', email: 'me@college.test', role, isBlocked: false },
        });
      if (url.pathname === '/api/equipment/export')
        return fail
          ? json({ error: { code: 'EXPORT_LIMIT' } }, 422)
          : new Response(new Blob(['xlsx']));
      return json({ data: [], page: 1, pageSize: 7, total: 0 });
    }),
  );
  return paths;
}
afterEach(() => {
  clearSession();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe('Equipment export', () => {
  it('is hidden for a teacher', async () => {
    mock('teacher');
    renderApp('/app/equipment');
    await screen.findByText('Самир');
    expect(screen.queryByRole('button', { name: 'Скачать XLSX' })).not.toBeInTheDocument();
  });
  it('downloads the filtered set without pagination and follows interface language', async () => {
    const paths = mock('technician');
    const create = vi.fn().mockReturnValue('blob:report');
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = create;
        static revokeObjectURL = vi.fn();
      },
    );
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    renderApp('/app/equipment');
    const button = await screen.findByRole('button', { name: 'Скачать XLSX' });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.type(screen.getByLabelText('Поиск', { exact: true }), 'monitor');
    await userEvent.selectOptions(screen.getByLabelText('Статус', { exact: true }), 'repair');
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    await waitFor(() => expect(click).toHaveBeenCalledOnce());
    const query = paths.find((url) => url.pathname === '/api/equipment/export')!.searchParams;
    expect(query.get('search')).toBe('monitor');
    expect(query.get('status')).toBe('repair');
    expect(query.get('page')).toBeNull();
    expect(query.get('pageSize')).toBeNull();
    expect(create).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Язык интерфейса' }));
    await userEvent.click(screen.getByRole('button', { name: 'Download XLSX' }));
    await waitFor(() =>
      expect(
        paths
          .filter((url) => url.pathname === '/api/equipment/export')
          .at(-1)!
          .searchParams.get('language'),
      ).toBe('en'),
    );
  });
  it('explains the export limit and permits retrying', async () => {
    mock('admin', true);
    renderApp('/app/equipment');
    const button = await screen.findByRole('button', { name: 'Скачать XLSX' });
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);
    expect(
      await screen.findByText('В выборке больше 5000 предметов. Уточните фильтры.'),
    ).toBeVisible();
    expect(button).toBeEnabled();
  });
});
