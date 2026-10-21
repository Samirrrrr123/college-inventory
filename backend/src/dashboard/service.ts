import { ApiError } from '../errors.js';
import { DashboardRepository } from './repository.js';

export class DashboardService {
  constructor(readonly repository: DashboardRepository) {}

  async summary(actor: { id: string; role: string }, now = new Date()) {
    if (!['teacher', 'technician', 'admin'].includes(actor.role))
      throw new ApiError(403, 'FORBIDDEN', 'Unknown role');
    const [
      groups,
      rooms,
      activeLoans,
      overdueLoans,
      pendingRequests,
      latestRequests,
      overdue,
    ] = await this.repository.summary(actor.role === 'teacher' ? actor.id : undefined, now);
    const equipment = { available: 0, issued: 0, repair: 0, written_off: 0 };
    for (const group of groups) equipment[group.status] = group._count._all;
    return {
      data: {
        generatedAt: now.toISOString(),
        scope: actor.role === 'teacher' ? 'own' : 'all',
        totalEquipment: Object.values(equipment).reduce((sum, count) => sum + count, 0),
        equipment,
        rooms,
        activeLoans,
        overdueLoans,
        pendingRequests,
        latestRequests,
        overdue,
      },
    };
  }
}
