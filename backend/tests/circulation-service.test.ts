import { describe, expect, it, vi } from 'vitest';
import { CirculationService } from '../src/circulation/service.js';
import type { CirculationRepository } from '../src/circulation/repository.js';

describe('Circulation service permissions', () => {
  it('rejects teacher decisions, issuing and returns before any database operation', () => {
    const write = vi.fn();
    const service = new CirculationService({ write } as unknown as CirculationRepository);
    const teacher = { id: 'teacher', role: 'teacher' };
    expect(() => service.decide('request', 'approved', '', teacher)).toThrow(
      'Insufficient permissions',
    );
    expect(() =>
      service.issue(
        {
          kind: 'request',
          requestId: 'request',
          dueAt: new Date(Date.now() + 86400000).toISOString(),
        },
        teacher,
      ),
    ).toThrow('Insufficient permissions');
    expect(() => service.returnLoan('loan', teacher)).toThrow('Insufficient permissions');
    expect(write).not.toHaveBeenCalled();
  });
});
