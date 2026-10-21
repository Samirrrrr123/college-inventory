import { describe, expect, it, vi } from 'vitest';
import { DashboardService } from '../src/dashboard/service.js';
import type { DashboardRepository } from '../src/dashboard/repository.js';

describe('Dashboard scope and totals', () => {
  it('limits teachers to their account and fills missing equipment statuses with zero', async () => {
    const repository = {
      summary: vi.fn().mockResolvedValue([
        [
          { status: 'available', _count: { _all: 4 } },
          { status: 'issued', _count: { _all: 2 } },
        ],
        3,
        1,
        1,
        2,
        [],
        [],
      ]),
    };
    const service = new DashboardService(repository as unknown as DashboardRepository);
    const now = new Date('2026-10-21T12:00:00Z');
    const result = await service.summary({ id: 'teacher-id', role: 'teacher' }, now);
    expect(repository.summary).toHaveBeenCalledWith('teacher-id', now);
    expect(result.data).toMatchObject({
      scope: 'own',
      totalEquipment: 6,
      equipment: { available: 4, issued: 2, repair: 0, written_off: 0 },
      rooms: 3,
      activeLoans: 1,
      overdueLoans: 1,
      pendingRequests: 2,
    });
    for (const role of ['admin', 'technician']) {
      expect((await service.summary({ id: 'staff', role }, now)).data.scope).toBe('all');
      expect(repository.summary).toHaveBeenLastCalledWith(undefined, now);
    }
  });
  it('rejects unknown roles without reading data', async () => {
    const repository = { summary: vi.fn() };
    const service = new DashboardService(repository as unknown as DashboardRepository);
    await expect(service.summary({ id: 'id', role: 'unknown' })).rejects.toMatchObject({
      status: 403,
    });
    expect(repository.summary).not.toHaveBeenCalled();
  });
});
