/**
 * Port (interface) MediaService depends on (issue #134). Two implementations exist:
 *  - PrismaMediaRepository (production, real Postgres via Prisma)
 *  - InMemoryMediaRepository (test double, src/media/testing/ — never wired into
 *    AppModule), mirroring the analysis/families repository pattern.
 *
 * The per-family encryption key lives on the Family row but is a media concern — key
 * accessors live here rather than widening FamiliesRepository, and the key is never
 * exposed through the shared Family type or any API response.
 */
import type { MediaAsset, MediaKind } from '@earlysteps/shared-types';

export const MEDIA_REPOSITORY = Symbol('MEDIA_REPOSITORY');

export interface CreateMediaAssetInput {
  childId: string;
  kind: MediaKind;
  mimeType: string;
  storageKey: string;
  capturedAt: Date;
  retentionExpiresAt: Date;
  /** Fresh per-capture consent-verification UUID — see MediaAsset.consentId. */
  consentId: string;
}

export interface MediaRepository {
  create(input: CreateMediaAssetInput): Promise<MediaAsset>;
  /** Non-deleted assets for this child, newest capture first. */
  listByChild(childId: string): Promise<MediaAsset[]>;
  /** Scoped to the child so a mediaId can never address another child's asset. */
  getByIdForChild(childId: string, mediaId: string): Promise<MediaAsset | null>;
  /** Tombstone before blob deletion — see MediaAsset.deletedAt. */
  markDeleted(mediaId: string, at: Date): Promise<void>;
  /** Final hard delete of the row, after the blob is gone. */
  deleteRow(mediaId: string): Promise<void>;
  /**
   * Everything due for hard deletion: past retentionExpiresAt (<= now) without a parent
   * retain override, plus any tombstoned row from a half-finished earlier delete.
   */
  listDueForDeletion(now: Date): Promise<MediaAsset[]>;
  getFamilyMediaKey(familyId: string): Promise<string | null>;
  setFamilyMediaKey(familyId: string, keyBase64: string): Promise<void>;
}
