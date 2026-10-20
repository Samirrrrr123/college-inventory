import { afterEach, expect, it, vi } from 'vitest';
import { loadReferences, queryString } from './catalog';
import { clearSession } from './client';

afterEach(() => {
  clearSession();
  vi.unstubAllGlobals();
});

it('loads every reference page when there are more than 100 records', async () => {
  clearSession();
  const pages: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (path: string) => {
      if (path === '/api/auth/refresh')
        return new Response(JSON.stringify({ data: { accessToken: 'token' } }));
      const page = new URL(path, 'http://localhost').searchParams.get('page')!;
      pages.push(page);
      const data =
        page === '1'
          ? Array.from({ length: 100 }, (_, index) => ({ id: String(index) }))
          : [{ id: 'last' }];
      return new Response(JSON.stringify({ data, page: Number(page), pageSize: 100, total: 101 }));
    }),
  );
  const rows = await loadReferences<{ id: string }>('categories');
  expect(rows).toHaveLength(101);
  expect(rows.at(-1)?.id).toBe('last');
  expect(pages).toEqual(['1', '2']);
});

it('preserves floor zero and omits empty filters', () => {
  expect(queryString({ floor: 0, search: '', status: undefined })).toBe('floor=0');
});
