/*
  Warnings:

  - You are about to drop the column `encryptedUri` on the `MediaAssetRecord` table. All the data in the column will be lost.
  - You are about to drop the column `retentionExpiry` on the `MediaAssetRecord` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `MediaAssetRecord` table. All the data in the column will be lost.
  - Added the required column `capturedAt` to the `MediaAssetRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `kind` to the `MediaAssetRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mimeType` to the `MediaAssetRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `retentionExpiresAt` to the `MediaAssetRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `storageKey` to the `MediaAssetRecord` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Family" ADD COLUMN     "mediaEncryptionKey" TEXT;

-- AlterTable
ALTER TABLE "MediaAssetRecord" DROP COLUMN "encryptedUri",
DROP COLUMN "retentionExpiry",
DROP COLUMN "type",
ADD COLUMN     "capturedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "kind" TEXT NOT NULL,
ADD COLUMN     "mimeType" TEXT NOT NULL,
ADD COLUMN     "retainedByParent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retentionExpiresAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "storageKey" TEXT NOT NULL;
