import type { Prisma } from '@prisma/client';
import { ApiError } from '../errors.js';
import { CirculationRepository, loanRelations, requestRelations } from './repository.js';
import type {
  Actor,
  LoanInput,
  LoanQuery,
  RecipientQuery,
  RequestInput,
  RequestQuery,
} from './schemas.js';

export class CirculationService {
  constructor(readonly repository: CirculationRepository) {}

  async recipients(query: RecipientQuery, actor: Actor) {
    this.staff(actor);
    const [data, total] = await this.repository.listRecipients(query);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async requests(query: RequestQuery, actor: Actor) {
    const [data, total] = await this.repository.listRequests(query, actor);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async loans(query: LoanQuery, actor: Actor) {
    const [data, total] = await this.repository.listLoans(query, actor);
    return { data, total, page: query.page, pageSize: query.pageSize };
  }

  async request(id: string, actor: Actor) {
    const result = await this.repository.request(id, actor);
    if (!result) throw new ApiError(404, 'NOT_FOUND', 'Request not found');
    return result;
  }

  async loan(id: string, actor: Actor) {
    const result = await this.repository.loan(id, actor);
    if (!result) throw new ApiError(404, 'NOT_FOUND', 'Loan not found');
    return result;
  }

  createRequest(input: RequestInput, actor: Actor) {
    return this.repository.write(async (tx) => {
      const count = await tx.equipment.count({
        where: { id: { in: input.equipmentIds }, status: { in: ['available', 'issued'] } },
      });
      if (count !== input.equipmentIds.length)
        throw new ApiError(409, 'EQUIPMENT_UNAVAILABLE', 'Some equipment cannot be requested');
      const result = await tx.equipmentRequest.create({
        data: {
          requesterId: actor.id,
          purpose: input.purpose,
          items: { create: input.equipmentIds.map((equipmentId) => ({ equipmentId })) },
        },
        include: requestRelations,
      });
      await this.record(tx, actor.id, 'requestCreated', 'request', result.id);
      return result;
    });
  }

  decide(id: string, status: 'approved' | 'rejected', note: string, actor: Actor) {
    this.staff(actor);
    return this.repository.write(async (tx) => {
      const current = await tx.equipmentRequest.findUnique({ where: { id } });
      if (!current) throw new ApiError(404, 'NOT_FOUND', 'Request not found');
      if (current.status !== 'pending')
        throw new ApiError(409, 'INVALID_TRANSITION', 'Request is already reviewed');
      const result = await tx.equipmentRequest.update({
        where: { id },
        data: { status, decisionNote: note, reviewerId: actor.id, reviewedAt: new Date() },
        include: requestRelations,
      });
      await this.record(
        tx,
        actor.id,
        status === 'approved' ? 'requestApproved' : 'requestRejected',
        'request',
        id,
      );
      return result;
    });
  }

  cancel(id: string, actor: Actor) {
    return this.repository.write(async (tx) => {
      const current = await tx.equipmentRequest.findUnique({
        where: { id },
        include: { loan: true },
      });
      if (!current || (actor.role === 'teacher' && current.requesterId !== actor.id))
        throw new ApiError(404, 'NOT_FOUND', 'Request not found');
      if (!['pending', 'approved'].includes(current.status) || current.loan)
        throw new ApiError(409, 'INVALID_TRANSITION', 'This request cannot be cancelled');
      const result = await tx.equipmentRequest.update({
        where: { id },
        data: { status: 'cancelled' },
        include: requestRelations,
      });
      await this.record(tx, actor.id, 'requestCancelled', 'request', id);
      return result;
    });
  }

  issue(input: LoanInput, actor: Actor) {
    this.staff(actor);
    const dueAt = new Date(input.dueAt);
    if (!Number.isFinite(dueAt.getTime()) || dueAt.getTime() <= Date.now())
      throw new ApiError(422, 'INVALID_DUE_DATE', 'The return deadline must be in the future');
    return this.repository.write(async (tx) => {
      let recipientId: string;
      let equipmentIds: string[];
      let requestId: string | undefined;
      if (input.kind === 'request') {
        const current = await tx.equipmentRequest.findUnique({
          where: { id: input.requestId },
          include: { items: true, loan: true },
        });
        if (!current) throw new ApiError(404, 'NOT_FOUND', 'Request not found');
        if (current.status !== 'approved')
          throw new ApiError(409, 'INVALID_TRANSITION', 'Approve the request first');
        if (current.loan)
          throw new ApiError(409, 'ALREADY_ISSUED', 'This request already has a loan');
        requestId = current.id;
        recipientId = current.requesterId;
        equipmentIds = current.items.map((item) => item.equipmentId);
      } else {
        recipientId = input.recipientId;
        equipmentIds = input.equipmentIds;
      }
      const recipient = await tx.user.findFirst({
        where: { id: recipientId, isBlocked: false },
      });
      if (!recipient)
        throw new ApiError(409, 'INVALID_RECIPIENT', 'The recipient is missing or blocked');
      const reserved = await tx.equipment.updateMany({
        where: { id: { in: equipmentIds }, status: 'available' },
        data: { status: 'issued' },
      });
      if (!equipmentIds.length || reserved.count !== equipmentIds.length)
        throw new ApiError(
          409,
          'EQUIPMENT_UNAVAILABLE',
          'The entire equipment set must be available',
        );
      const result = await tx.loan.create({
        data: {
          requestId,
          recipientId,
          issuedById: actor.id,
          dueAt,
          items: { create: equipmentIds.map((equipmentId) => ({ equipmentId })) },
        },
        include: loanRelations,
      });
      await this.record(tx, actor.id, 'loanIssued', 'loan', result.id);
      return result;
    });
  }

  returnLoan(id: string, actor: Actor) {
    this.staff(actor);
    return this.repository.write(async (tx) => {
      const current = await tx.loan.findUnique({ where: { id }, include: { items: true } });
      if (!current) throw new ApiError(404, 'NOT_FOUND', 'Loan not found');
      if (current.returnedAt)
        throw new ApiError(409, 'ALREADY_RETURNED', 'The loan has already been returned');
      const changed = await tx.loan.updateMany({
        where: { id, returnedAt: null },
        data: { returnedAt: new Date(), returnedById: actor.id },
      });
      if (changed.count !== 1)
        throw new ApiError(409, 'ALREADY_RETURNED', 'The loan has already been returned');
      const ids = current.items.map((item) => item.equipmentId);
      const restored = await tx.equipment.updateMany({
        where: { id: { in: ids }, status: 'issued' },
        data: { status: 'available' },
      });
      if (restored.count !== ids.length)
        throw new ApiError(409, 'CONCURRENT_CHANGE', 'Equipment status has changed');
      await this.record(tx, actor.id, 'loanReturned', 'loan', id);
      return tx.loan.findUniqueOrThrow({ where: { id }, include: loanRelations });
    });
  }

  private staff(actor: Actor) {
    if (!['technician', 'admin'].includes(actor.role))
      throw new ApiError(403, 'FORBIDDEN', 'Insufficient permissions');
  }

  private record(
    tx: Prisma.TransactionClient,
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
  ) {
    return tx.auditEntry.create({ data: { actorId, action, entityType, entityId } });
  }
}
