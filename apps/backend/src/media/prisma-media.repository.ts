import { Injectable } from '@nestjs/common';
import type { MediaAsset, MediaKind } from '@earlysteps/shared-types';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateMediaAssetInput, MediaRepository } from './media.repository.js';

function toMediaAsset(row: {
  id: string;
  childId: string;
  kind: string;
  mimeType: string;
  consentId: string;
  storageKey: string;
  capturedAt: Date;
  retentionExpiresAt: Date;
  retainedByParent: boolean;
  deletedAt: Date | null;
}): MediaAsset {
  return {
    id: row.id,
    childId: row.childId,
    kind: row.kind as MediaKind,
    mimeType: row.mimeType,
    consentId: row.consentId,
    storageKey: row.storageKey,
    capturedAt: row.capturedAt.toISOString(),
    retentionExpiresAt: row.retentionExpiresAt.toISOString(),
    retainedByParent: row.retainedByParent,
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

@Injectable()
export class PrismaMediaRepository implements MediaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateMediaAssetInput): Promise<MediaAsset> {
    const row = await this.prisma.mediaAssetRecord.create({
      data: {
        childId: input.childId,
        kind: input.kind,
        mimeType: input.mimeType,
        storageKey: input.storageKey,
        capturedAt: input.capturedAt,
        retentionExpiresAt: input.retentionExpiresAt,
        consentId: input.consentId,
      },
    });
    return toMediaAsset(row);
  }

  async listByChild(childId: string): Promise<MediaAsset[]> {
    const rows = await this.prisma.mediaAssetRecord.findMany({
      where: { childId, deletedAt: null },
      orderBy: { capturedAt: 'desc' },
    });
    return rows.map(toMediaAsset);
  }

  async getByIdForChild(childId: string, mediaId: string): Promise<MediaAsset | null> {
    const row = await this.prisma.mediaAssetRecord.findUnique({
      where: { id: mediaId },
    });
    if (!row || row.childId !== childId || row.deletedAt) return null;
    return toMediaAsset(row);
  }

  async markDeleted(mediaId: string, at: Date): Promise<void> {
    await this.prisma.mediaAssetRecord.update({
      where: { id: mediaId },
      data: { deletedAt: at },
    });
  }

  async deleteRow(mediaId: string): Promise<void> {
    await this.prisma.mediaAssetRecord.delete({ where: { id: mediaId } });
  }

  async listDueForDeletion(now: Date): Promise<MediaAsset[]> {
    const rows = await this.prisma.mediaAssetRecord.findMany({
      where: {
        OR: [
          { retentionExpiresAt: { lte: now }, retainedByParent: false },
          { deletedAt: { not: null } },
        ],
      },
    });
    return rows.map(toMediaAsset);
  }

  async getFamilyMediaKey(familyId: string): Promise<string | null> {
    const row = await this.prisma.family.findUnique({
      where: { id: familyId },
      select: { mediaEncryptionKey: true },
    });
    return row?.mediaEncryptionKey ?? null;
  }

  async setFamilyMediaKey(familyId: string, keyBase64: string): Promise<void> {
    await this.prisma.family.update({
      where: { id: familyId },
      data: { mediaEncryptionKey: keyBase64 },
    });
  }
}
