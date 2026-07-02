-- AlterTable
ALTER TABLE "IntakeResponseRecord" ADD COLUMN     "analyzedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "FollowUpSuggestionRecord" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "followUpId" TEXT NOT NULL,
    "redFlagType" TEXT NOT NULL,
    "sourceQuestionId" TEXT NOT NULL,
    "sourceQuote" TEXT NOT NULL,
    "salience" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "FollowUpSuggestionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FollowUpSuggestionRecord_childId_status_idx" ON "FollowUpSuggestionRecord"("childId", "status");

-- AddForeignKey
ALTER TABLE "FollowUpSuggestionRecord" ADD CONSTRAINT "FollowUpSuggestionRecord_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
