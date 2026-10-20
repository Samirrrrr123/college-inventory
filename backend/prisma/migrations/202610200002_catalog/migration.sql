CREATE TYPE "EquipmentStatus" AS ENUM ('available', 'issued', 'repair', 'written_off');
ALTER TABLE "AuditEntry" ADD COLUMN "entityType" TEXT, ADD COLUMN "entityId" UUID, ADD COLUMN "details" JSONB;
CREATE TABLE "Category" (
  "id" UUID NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Room" (
  "id" UUID NOT NULL,
  "number" VARCHAR(30) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "building" VARCHAR(100) NOT NULL,
  "floor" INTEGER NOT NULL,
  CONSTRAINT "Room_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Room_floor_check" CHECK ("floor" BETWEEN -5 AND 100)
);
CREATE TABLE "Equipment" (
  "id" UUID NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "inventoryNumber" VARCHAR(80) NOT NULL,
  "serialNumber" VARCHAR(100),
  "description" VARCHAR(5000) NOT NULL DEFAULT '',
  "status" "EquipmentStatus" NOT NULL DEFAULT 'available',
  "categoryId" UUID NOT NULL,
  "roomId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Movement" (
  "id" UUID NOT NULL,
  "equipmentId" UUID NOT NULL,
  "fromRoomId" UUID NOT NULL,
  "toRoomId" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "reason" VARCHAR(1000) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Movement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Movement_rooms_check" CHECK ("fromRoomId" <> "toRoomId")
);
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");
CREATE UNIQUE INDEX "Room_building_number_key" ON "Room"("building", "number");
CREATE INDEX "Room_number_idx" ON "Room"("number");
CREATE UNIQUE INDEX "Equipment_inventoryNumber_key" ON "Equipment"("inventoryNumber");
CREATE INDEX "Equipment_categoryId_idx" ON "Equipment"("categoryId");
CREATE INDEX "Equipment_roomId_idx" ON "Equipment"("roomId");
CREATE INDEX "Equipment_status_createdAt_id_idx" ON "Equipment"("status", "createdAt", "id");
CREATE INDEX "Equipment_name_id_idx" ON "Equipment"("name", "id");
CREATE INDEX "Movement_equipmentId_createdAt_idx" ON "Movement"("equipmentId", "createdAt");
CREATE INDEX "Movement_fromRoomId_idx" ON "Movement"("fromRoomId");
CREATE INDEX "Movement_toRoomId_idx" ON "Movement"("toRoomId");
CREATE INDEX "Movement_actorId_idx" ON "Movement"("actorId");
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_fromRoomId_fkey" FOREIGN KEY ("fromRoomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_toRoomId_fkey" FOREIGN KEY ("toRoomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Movement" ADD CONSTRAINT "Movement_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
