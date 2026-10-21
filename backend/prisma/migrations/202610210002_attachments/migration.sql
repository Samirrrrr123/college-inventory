CREATE TABLE "Attachment" (
    "id" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "contentType" VARCHAR(40) NOT NULL,
    "size" INTEGER NOT NULL,
    "content" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Attachment_equipmentId_createdAt_idx" ON "Attachment"("equipmentId", "createdAt");
CREATE INDEX "Attachment_uploadedById_idx" ON "Attachment"("uploadedById");
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
