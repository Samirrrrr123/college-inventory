import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config.js';
import { AuthRepository } from '../src/auth/repository.js';
import { AuthService } from '../src/auth/service.js';

const config = loadConfig({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://unit:unit@127.0.0.1/unit_test',
  CLIENT_ORIGIN: 'http://127.0.0.1:5173',
  ACCESS_SECRET: 'unit-access-secret-with-32-characters',
  REFRESH_SECRET: 'unit-refresh-secret-with-32-characters',
});

describe('Authentication service', () => {
  it('rejects a token with the wrong issuer before querying the repository', async () => {
    const findSession = vi.fn();
    const repository = { findSession } as unknown as AuthRepository;
    const service = new AuthService(repository, config, vi.fn());
    const token = jwt.sign({ sid: 'session', type: 'access' }, config.ACCESS_SECRET, {
      subject: 'user',
      issuer: 'another-app',
      audience: 'inventory-client',
    });
    await expect(service.authenticate(token)).rejects.toMatchObject({ status: 401 });
    expect(findSession).not.toHaveBeenCalled();
  });
  it('rejects a token of the wrong type even with a valid signature', async () => {
    const findSession = vi.fn();
    const service = new AuthService(
      { findSession } as unknown as AuthRepository,
      config,
      vi.fn(),
    );
    const token = jwt.sign({ sid: 'session', type: 'refresh' }, config.ACCESS_SECRET, {
      subject: 'user',
      issuer: 'college-inventory',
      audience: 'inventory-client',
    });
    await expect(service.authenticate(token)).rejects.toMatchObject({ status: 401 });
    expect(findSession).not.toHaveBeenCalled();
  });
  it('never changes credentials when the current password is wrong', async () => {
    const passwordHash = await bcrypt.hash('Actual-password', 4);
    const replacePassword = vi.fn();
    const repository = {
      db: { user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ passwordHash }) } },
      replacePassword,
    } as unknown as AuthRepository;
    const service = new AuthService(repository, config, vi.fn());
    await expect(
      service.changePassword('user', 'Wrong-password', 'New-password'),
    ).rejects.toMatchObject({ code: 'WRONG_PASSWORD' });
    expect(replacePassword).not.toHaveBeenCalled();
  });
  it('revokes a password reset only when the repository atomically consumes it', async () => {
    const replacePassword = vi.fn().mockResolvedValue(false);
    const repository = {
      db: {
        passwordReset: {
          findUnique: vi
            .fn()
            .mockResolvedValue({ userId: 'user', expiresAt: new Date(Date.now() + 60000) }),
        },
        user: { findUnique: vi.fn().mockResolvedValue({ isBlocked: false }) },
      },
      replacePassword,
    } as unknown as AuthRepository;
    const service = new AuthService(repository, config, vi.fn());
    await expect(
      service.resetPassword('already-consumed-token', 'New-password'),
    ).rejects.toMatchObject({ code: 'INVALID_RESET_TOKEN' });
    expect(replacePassword).toHaveBeenCalledOnce();
  });
});
