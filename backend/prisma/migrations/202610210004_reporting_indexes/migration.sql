CREATE INDEX "AuditEntry_createdAt_id_idx" ON "AuditEntry"("createdAt", "id");
CREATE INDEX "AuditEntry_entityType_entityId_createdAt_idx" ON "AuditEntry"("entityType", "entityId", "createdAt");
CREATE INDEX "AuditEntry_action_createdAt_idx" ON "AuditEntry"("action", "createdAt");
CREATE INDEX "Movement_createdAt_id_idx" ON "Movement"("createdAt", "id");
CREATE INDEX "Loan_issuedAt_idx" ON "Loan"("issuedAt");
