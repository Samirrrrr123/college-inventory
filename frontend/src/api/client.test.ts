import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, clearSession, signIn } from './client';

beforeEach(() => clearSession());
afterEach(() => {
  clearSession();
  vi.unstubAllGlobals();
});
const result = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

describe('API sessions', () => {
  it('retries the same file after refresh and receives authenticated binary downloads', async () => {
    const file = new File(['photo'], 'фото.png', { type: 'image/png' });
    let uploads = 0;
    const fetch = vi.fn(async (path: string, options: RequestInit) => {
      if (path === '/api/auth/refresh') return result({ data: { accessToken: 'fresh' } });
      expect(options.headers).toMatchObject({ Authorization: 'Bearer fresh' });
      if (options.method === 'POST') {
        expect(options.body).toBe(file);
        expect(options.headers).toMatchObject({
          'X-File-Name': encodeURIComponent(file.name),
          'Content-Type': 'image/png',
        });
        uploads += 1;
        return uploads === 1
          ? result({ error: { code: 'UNAUTHORIZED' } }, 401)
          : result({ data: { id: 'file' } });
      }
      return new Response('file-bytes', { headers: { 'Content-Type': 'image/png' } });
    });
    vi.stubGlobal('fetch', fetch);
    await expect(api('/equipment/id/files', 'POST', file)).resolves.toEqual({
      data: { id: 'file' },
    });
    expect(uploads).toBe(2);
    const blob = await api<Blob>('/equipment/id/files/file', 'GET', undefined, true);
    expect(await blob.text()).toBe('file-bytes');
  });
  it('refreshes once for concurrent requests and keeps tokens out of web storage', async () => {
    const fetch = vi.fn(async (path: string, options: RequestInit) => {
      if (path === '/api/auth/refresh')
        return result({ data: { accessToken: 'new-access-token' } });
      expect(options.headers).toMatchObject({ Authorization: 'Bearer new-access-token' });
      expect(options.credentials).toBe('include');
      return result({ data: path });
    });
    vi.stubGlobal('fetch', fetch);
    await Promise.all([api('/me'), api('/me/activity')]);
    expect(fetch.mock.calls.filter(([path]) => path === '/api/auth/refresh')).toHaveLength(1);
    expect(JSON.stringify(localStorage)).not.toContain('new-access-token');
    expect(JSON.stringify(sessionStorage)).not.toContain('new-access-token');
  });
  it('retries a request once after an expired access token', async () => {
    let attempts = 0;
    const fetch = vi.fn(async (path: string) => {
      if (path === '/api/auth/login') return result({ data: { accessToken: 'expired-access' } });
      if (path === '/api/auth/refresh') return result({ data: { accessToken: 'fresh-access' } });
      attempts += 1;
      return attempts === 1
        ? result({ error: { code: 'UNAUTHORIZED' } }, 401)
        : result({ data: { id: 'current-user' } });
    });
    vi.stubGlobal('fetch', fetch);
    await signIn('person@college.test', 'Password-2026');
    expect(await api('/me')).toEqual({ data: { id: 'current-user' } });
    expect(attempts).toBe(2);
    expect(fetch.mock.calls.filter(([path]) => path === '/api/auth/refresh')).toHaveLength(1);
  });
  it('does not send protected requests when the refresh session is revoked', async () => {
    const fetch = vi.fn(async () => result({ error: { code: 'UNAUTHORIZED' } }, 401));
    vi.stubGlobal('fetch', fetch);
    await expect(api('/me')).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
    expect(fetch).toHaveBeenCalledOnce();
  });
});
