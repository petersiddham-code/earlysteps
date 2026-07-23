/**
 * Test double ONLY. Never register this in AppModule/MediaModule providers — production
 * always uses PrismaMediaRepository. Mirrors the in-memory families/analysis doubles.
 */
import type { MediaAsset } from '@earlysteps/shared-types';
import type { CreateMediaAssetInput, MediaRepository } from '../media.repository.js';

let nextId = 0;

export class InMemoryMediaRepository implements MediaRepository {
  private readonly assets = new Map<string, MediaAsset>();
  private readonly familyKeys = new Map<string, string>();

  async create(input: CreateMediaAssetInput): Promise<MediaAsset> {
    nextId += 1;
    const asset: MediaAsset = {
      id: `media-${nextId}`,
      childId: input.childId,
      kind: input.kind,
      mimeType: input.mimeType,
      storageKey: input.storageKey,
      capturedAt: input.capturedAt.toISOString(),
      retentionExpiresAt: input.retentionExpiresAt.toISOString(),
      retainedByParent: false,
      consentId: input.consentId,
      deletedAt: null,
      transcript: null,
      transcribedAt: null,
    };
    this.assets.set(asset.id, asset);
    return asset;
  }

  async listByChild(childId: string): Promise<MediaAsset[]> {
    return [...this.assets.values()]
      .filter((a) => a.childId === childId && a.deletedAt === null)
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  }

  async getByIdForChild(childId: string, mediaId: string): Promise<MediaAsset | null> {
    const asset = this.assets.get(mediaId);
    if (!asset || asset.childId !== childId || asset.deletedAt !== null) return null;
    return asset;
  }

  async markDeleted(mediaId: string, at: Date): Promise<void> {
    const asset = this.assets.get(mediaId);
    if (asset) this.assets.set(mediaId, { ...asset, deletedAt: at.toISOString() });
  }

  async deleteRow(mediaId: string): Promise<void> {
    this.assets.delete(mediaId);
  }

  async listDueForDeletion(now: Date): Promise<MediaAsset[]> {
    return [...this.assets.values()].filter(
      (a) =>
        a.deletedAt !== null ||
        (!a.retainedByParent && new Date(a.retentionExpiresAt) <= now),
    );
  }

  async getFamilyMediaKey(familyId: string): Promise<string | null> {
    return this.familyKeys.get(familyId) ?? null;
  }

  async setFamilyMediaKey(familyId: string, keyBase64: string): Promise<void> {
    this.familyKeys.set(familyId, keyBase64);
  }

  async setTranscript(
    mediaId: string,
    transcript: string,
    transcribedAt: Date,
  ): Promise<void> {
    const asset = this.assets.get(mediaId);
    if (asset) {
      this.assets.set(mediaId, {
        ...asset,
        transcript,
        transcribedAt: transcribedAt.toISOString(),
      });
    }
  }

  /** Test-only helpers. */
  allAssets(): MediaAsset[] {
    return [...this.assets.values()];
  }

  /** Test-only: overwrite fields (e.g. retention dates) to stage boundary cases. */
  patchAsset(mediaId: string, patch: Partial<MediaAsset>): void {
    const asset = this.assets.get(mediaId);
    if (!asset) throw new Error(`No asset ${mediaId}`);
    this.assets.set(mediaId, { ...asset, ...patch });
  }

  /**
   * Mirrors PrismaFamiliesRepository.updateMediaRetentionDays' retroactive recompute
   * (issue #142): tests wire InMemoryFamiliesRepository.onUpdateMediaRetentionForFamily to
   * this, since the real recompute lives on the media side of the same DB in production.
   */
  recomputeRetentionForChildren(childIds: string[], days: number): void {
    const ids = new Set(childIds);
    for (const asset of this.assets.values()) {
      if (!ids.has(asset.childId) || asset.deletedAt !== null || asset.retainedByParent) {
        continue;
      }
      this.assets.set(asset.id, {
        ...asset,
        retentionExpiresAt: new Date(
          new Date(asset.capturedAt).getTime() + days * 24 * 60 * 60 * 1000,
        ).toISOString(),
      });
    }
  }
}
