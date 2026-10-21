CREATE TABLE "InventoryCheck" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "roomId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "completedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "InventoryCheck_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryItem" (
    "checkId" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "equipmentName" VARCHAR(200) NOT NULL,
    "inventoryNumber" VARCHAR(80) NOT NULL,
    "statusAtStart" "EquipmentStatus" NOT NULL,
    "found" BOOLEAN,
    "checkedAt" TIMESTAMP(3),
    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("checkId", "equipmentId")
);

CREATE UNIQUE INDEX "InventoryCheck_number_key" ON "InventoryCheck"("number");
CREATE INDEX "InventoryCheck_roomId_createdAt_idx" ON "InventoryCheck"("roomId", "createdAt");
CREATE INDEX "InventoryCheck_createdById_idx" ON "InventoryCheck"("createdById");
CREATE INDEX "InventoryCheck_completedById_idx" ON "InventoryCheck"("completedById");
CREATE INDEX "InventoryCheck_completedAt_idx" ON "InventoryCheck"("completedAt");
CREATE INDEX "InventoryItem_equipmentId_idx" ON "InventoryItem"("equipmentId");
CREATE INDEX "InventoryItem_checkId_found_idx" ON "InventoryItem"("checkId", "found");
ALTER TABLE "InventoryCheck" ADD CONSTRAINT "InventoryCheck_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "InventoryCheck" ADD CONSTRAINT "InventoryCheck_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "InventoryCheck" ADD CONSTRAINT "InventoryCheck_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "InventoryCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
