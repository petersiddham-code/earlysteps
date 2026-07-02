-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "lowBandwidthMode" BOOLEAN NOT NULL DEFAULT false,
    "consentFlags" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Child" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "ageBand" TEXT NOT NULL,
    "languages" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeResponseRecord" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "answer" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntakeResponseRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityResultRecord" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "ageBand" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "responseData" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityResultRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainProfileRecord" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "findings" JSONB NOT NULL,

    CONSTRAINT "DomainProfileRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportLevelEstimateRecord" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportLevelEstimateRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RedFlagRecord" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL,
    "evidenceRefs" JSONB NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RedFlagRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportPlanRecord" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "tasks" JSONB NOT NULL,
    "scripts" JSONB NOT NULL,
    "rewards" JSONB NOT NULL,
    "checklistState" JSONB NOT NULL,

    CONSTRAINT "SupportPlanRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressLogRecord" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "note" TEXT,

    CONSTRAINT "ProgressLogRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaAssetRecord" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "consentId" TEXT NOT NULL,
    "retentionExpiry" TIMESTAMP(3) NOT NULL,
    "encryptedUri" TEXT NOT NULL,

    CONSTRAINT "MediaAssetRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportRecord" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL,
    "pdfUri" TEXT NOT NULL,
    "sharedWith" TEXT[],

    CONSTRAINT "ReportRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Child_familyId_idx" ON "Child"("familyId");

-- CreateIndex
CREATE INDEX "IntakeResponseRecord_childId_idx" ON "IntakeResponseRecord"("childId");

-- CreateIndex
CREATE INDEX "ActivityResultRecord_childId_idx" ON "ActivityResultRecord"("childId");

-- CreateIndex
CREATE INDEX "DomainProfileRecord_childId_computedAt_idx" ON "DomainProfileRecord"("childId", "computedAt");

-- CreateIndex
CREATE INDEX "SupportLevelEstimateRecord_childId_computedAt_idx" ON "SupportLevelEstimateRecord"("childId", "computedAt");

-- CreateIndex
CREATE INDEX "RedFlagRecord_childId_idx" ON "RedFlagRecord"("childId");

-- CreateIndex
CREATE INDEX "SupportPlanRecord_childId_idx" ON "SupportPlanRecord"("childId");

-- CreateIndex
CREATE INDEX "ProgressLogRecord_childId_idx" ON "ProgressLogRecord"("childId");

-- CreateIndex
CREATE INDEX "MediaAssetRecord_childId_idx" ON "MediaAssetRecord"("childId");

-- CreateIndex
CREATE INDEX "ReportRecord_childId_idx" ON "ReportRecord"("childId");

-- AddForeignKey
ALTER TABLE "Child" ADD CONSTRAINT "Child_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeResponseRecord" ADD CONSTRAINT "IntakeResponseRecord_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityResultRecord" ADD CONSTRAINT "ActivityResultRecord_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainProfileRecord" ADD CONSTRAINT "DomainProfileRecord_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportLevelEstimateRecord" ADD CONSTRAINT "SupportLevelEstimateRecord_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RedFlagRecord" ADD CONSTRAINT "RedFlagRecord_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportPlanRecord" ADD CONSTRAINT "SupportPlanRecord_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressLogRecord" ADD CONSTRAINT "ProgressLogRecord_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaAssetRecord" ADD CONSTRAINT "MediaAssetRecord_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportRecord" ADD CONSTRAINT "ReportRecord_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
