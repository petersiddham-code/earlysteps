-- AlterTable
ALTER TABLE "MediaAssetRecord" ADD COLUMN     "transcribedAt" TIMESTAMP(3),
ADD COLUMN     "transcript" TEXT;
