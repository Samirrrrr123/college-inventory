import { ApiError } from '../errors.js';
import { HistoryRepository } from './repository.js';
import type { Actor, AuditQuery, MovementQuery } from './schemas.js';

export class HistoryService {
  constructor(readonly repository: HistoryRepository) {}

  async audit(query: AuditQuery, actor: Actor) {
    if (actor.role !== 'admin')
      throw new ApiError(403, 'FORBIDDEN', 'Administrator access required');
    const [data, total] = await this.repository.audit(query);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async movements(query: MovementQuery, actor: Actor) {
    if (!['technician', 'admin'].includes(actor.role))
      throw new ApiError(403, 'FORBIDDEN', 'Staff access required');
    const [data, total] = await this.repository.movements(query);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }
}
