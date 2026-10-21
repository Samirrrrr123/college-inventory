import { describe, expect, it, vi } from 'vitest';
import { HistoryService } from '../src/history/service.js';
import type { HistoryRepository } from '../src/history/repository.js';
import { auditQuery, movementQuery } from '../src/history/schemas.js';

describe('History service permissions', () => {
  it('denies non-admin audit access before querying the repository', async () => {
    const repository = { audit: vi.fn() };
    const service = new HistoryService(repository as unknown as HistoryRepository);
    for (const role of ['teacher', 'technician', 'unknown'])
      await expect(
        service.audit(auditQuery.parse({}), { id: 'actor', role }),
      ).rejects.toMatchObject({ status: 403 });
    expect(repository.audit).not.toHaveBeenCalled();
  });
  it('denies non-staff movement access before querying the repository', async () => {
    const repository = { movements: vi.fn() };
    const service = new HistoryService(repository as unknown as HistoryRepository);
    await expect(
      service.movements(movementQuery.parse({}), { id: 'actor', role: 'teacher' }),
    ).rejects.toMatchObject({ status: 403 });
    expect(repository.movements).not.toHaveBeenCalled();
  });
});
