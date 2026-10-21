import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PreferencesProvider } from '../../app/Preferences';
import { EquipmentFiles } from './EquipmentFiles';
import { clearSession } from '../../api/client';

const result = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
afterEach(() => {
  clearSession();
  vi.unstubAllGlobals();
});

describe('Equipment files', () => {
  it('checks type and size before uploading and keeps a failed upload visible', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const uploads: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, options: RequestInit) => {
        if (path === '/api/auth/refresh') return result({ data: { accessToken: 'token' } });
        if (options.method === 'POST') {
          uploads.push(options.body);
          return result({ error: { code: 'INVALID_FILE_TYPE' } }, 415);
        }
        return result({ data: [], total: 0, page: 1, pageSize: 5 });
      }),
    );
    render(
      <PreferencesProvider>
        <MemoryRouter>
          <EquipmentFiles equipmentId="equipment" canManage />
        </MemoryRouter>
      </PreferencesProvider>,
    );
    const input = screen.getByLabelText('Прикрепить фото или документ');
    await user.upload(input, new File(['bad'], 'bad.svg', { type: 'image/svg+xml' }));
    await user.click(screen.getByRole('button', { name: 'Загрузить файл' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Разрешены только JPG, PNG и PDF');
    await user.upload(input, new File([new Uint8Array(5242881)], 'big.png', { type: 'image/png' }));
    await user.click(screen.getByRole('button', { name: 'Загрузить файл' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('5 МБ');
    expect(uploads).toHaveLength(0);
    const file = new File(['wrong bytes'], 'photo.png', { type: 'image/png' });
    await user.upload(input, file);
    await user.click(screen.getByRole('button', { name: 'Загрузить файл' }));
    await waitFor(() => expect(uploads).toEqual([file]));
    expect(await screen.findByRole('alert')).toHaveTextContent('Разрешены только JPG, PNG и PDF');
    expect((input as HTMLInputElement).files?.[0]).toBe(file);
  });

  it('requires confirmation before deletion and gives readers only downloads', async () => {
    const user = userEvent.setup();
    const mutations: string[] = [];
    const file = { id: 'file', name: 'manual.pdf', size: 100, createdAt: '2026-10-21T08:00:00Z' };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (path: string, options: RequestInit) => {
        if (path === '/api/auth/refresh') return result({ data: { accessToken: 'token' } });
        if (options.method === 'DELETE') {
          mutations.push(path);
          return new Response(null, { status: 204 });
        }
        return result({
          data: mutations.length ? [] : [file],
          total: mutations.length ? 0 : 1,
          page: 1,
          pageSize: 5,
        });
      }),
    );
    const view = render(
      <PreferencesProvider>
        <MemoryRouter>
          <EquipmentFiles equipmentId="equipment" canManage={false} />
        </MemoryRouter>
      </PreferencesProvider>,
    );
    await screen.findByText('manual.pdf');
    expect(screen.queryByRole('button', { name: 'Удалить: manual.pdf' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Скачать' })).toBeInTheDocument();
    view.rerender(
      <PreferencesProvider>
        <MemoryRouter>
          <EquipmentFiles equipmentId="equipment" canManage />
        </MemoryRouter>
      </PreferencesProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'Удалить: manual.pdf' }));
    expect(mutations).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Удалить файл' }));
    await waitFor(() => expect(mutations).toEqual(['/api/equipment/equipment/files/file']));
    expect(await screen.findByText('Файлов пока нет')).toBeInTheDocument();
  });
});
