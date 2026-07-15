-- CreateTable
CREATE TABLE "ContentDraft" (
    "id" TEXT NOT NULL,
    "contentKey" TEXT NOT NULL,
    "fieldPath" TEXT NOT NULL,
    "currentValue" TEXT NOT NULL,
    "proposedValue" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "discardedAt" TIMESTAMP(3),

    CONSTRAINT "ContentDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentDraft_contentKey_status_idx" ON "ContentDraft"("contentKey", "status");

-- AddForeignKey
ALTER TABLE "ContentDraft" ADD CONSTRAINT "ContentDraft_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
