-- CreateTable
CREATE TABLE "AiResultsSummaryRecord" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiResultsSummaryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiResultsSummaryRecord_childId_key" ON "AiResultsSummaryRecord"("childId");

-- AddForeignKey
ALTER TABLE "AiResultsSummaryRecord" ADD CONSTRAINT "AiResultsSummaryRecord_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
