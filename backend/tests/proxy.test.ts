import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { AuthService } from '../src/auth/service.js';
import type { AuthRepository } from '../src/auth/repository.js';

describe('Authentication rate limit behind production proxies', () => {
  it('counts visitors separately and ignores extra addresses supplied before the trusted path', async () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      TRUST_PROXY_HOPS: '2',
      DATABASE_URL: 'postgresql://unit:unit@127.0.0.1/proxy_test',
      CLIENT_ORIGIN: 'https://college.test',
      ACCESS_SECRET: 'unit-access-secret-with-32-characters',
      REFRESH_SECRET: 'unit-refresh-secret-with-32-characters',
    });
    const repository = { db: {} } as unknown as AuthRepository;
    const app = createApp(new AuthService(repository, config, vi.fn()), config);
    const attempt = (forwarded: string) =>
      request(app)
        .post('/api/auth/login')
        .set('Origin', config.CLIENT_ORIGIN)
        .set('X-Forwarded-For', forwarded)
        .send({});
    const first = await attempt('198.51.100.10, 172.18.0.2').expect(422);
    const spoofed = await attempt('203.0.113.50, 198.51.100.10, 172.18.0.2').expect(422);
    const secondVisitor = await attempt('198.51.100.11, 172.18.0.2').expect(422);
    expect(first.headers.ratelimit).toContain('r=99');
    expect(spoofed.headers.ratelimit).toContain('r=98');
    expect(secondVisitor.headers.ratelimit).toContain('r=99');
  });
});
