CREATE TYPE "RequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

CREATE TABLE "EquipmentRequest" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "requesterId" UUID NOT NULL,
    "reviewerId" UUID,
    "purpose" VARCHAR(300) NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'pending',
    "decisionNote" VARCHAR(500) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "EquipmentRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RequestItem" (
    "requestId" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,

    CONSTRAINT "RequestItem_pkey" PRIMARY KEY ("requestId","equipmentId")
);

CREATE TABLE "Loan" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "requestId" UUID,
    "recipientId" UUID NOT NULL,
    "issuedById" UUID NOT NULL,
    "returnedById" UUID,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "returnedAt" TIMESTAMP(3),

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoanItem" (
    "loanId" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,

    CONSTRAINT "LoanItem_pkey" PRIMARY KEY ("loanId","equipmentId")
);

CREATE UNIQUE INDEX "EquipmentRequest_number_key" ON "EquipmentRequest"("number");

CREATE INDEX "EquipmentRequest_requesterId_createdAt_idx" ON "EquipmentRequest"("requesterId", "createdAt");

CREATE INDEX "EquipmentRequest_status_createdAt_idx" ON "EquipmentRequest"("status", "createdAt");

CREATE INDEX "RequestItem_equipmentId_idx" ON "RequestItem"("equipmentId");

CREATE UNIQUE INDEX "Loan_number_key" ON "Loan"("number");

CREATE UNIQUE INDEX "Loan_requestId_key" ON "Loan"("requestId");

CREATE INDEX "Loan_recipientId_issuedAt_idx" ON "Loan"("recipientId", "issuedAt");

CREATE INDEX "Loan_returnedAt_dueAt_idx" ON "Loan"("returnedAt", "dueAt");

CREATE INDEX "Loan_issuedById_idx" ON "Loan"("issuedById");

CREATE INDEX "Loan_returnedById_idx" ON "Loan"("returnedById");

CREATE INDEX "LoanItem_equipmentId_idx" ON "LoanItem"("equipmentId");

ALTER TABLE "EquipmentRequest" ADD CONSTRAINT "EquipmentRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "EquipmentRequest" ADD CONSTRAINT "EquipmentRequest_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "RequestItem" ADD CONSTRAINT "RequestItem_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "EquipmentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RequestItem" ADD CONSTRAINT "RequestItem_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "Loan" ADD CONSTRAINT "Loan_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "EquipmentRequest"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "Loan" ADD CONSTRAINT "Loan_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "Loan" ADD CONSTRAINT "Loan_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "Loan" ADD CONSTRAINT "Loan_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "LoanItem" ADD CONSTRAINT "LoanItem_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LoanItem" ADD CONSTRAINT "LoanItem_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
