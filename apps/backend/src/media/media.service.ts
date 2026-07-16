import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MEDIA_KINDS, type MediaAsset, type MediaKind } from '@earlysteps/shared-types';
import {
  FAMILIES_REPOSITORY,
  type FamiliesRepository,
} from '../families/families.repository.js';
import { MEDIA_REPOSITORY, type MediaRepository } from './media.repository.js';
import {
  OBJECT_STORAGE_SERVICE,
  type ObjectStorageService,
} from './object-storage/object-storage.js';
import { MediaEncryptionService } from './media-encryption.service.js';

/**
 * Fixed retention window (product plan §4.7): capturedAt + 90 days, then the daily job
 * below hard-deletes unless the parent explicitly retained the capture. A parent-facing
 * setting to change this window is explicitly out of scope for Phase 1 (issue #133 plan).
 */
export const MEDIA_RETENTION_DAYS = 90;

/**
 * Phase 2 (issue #135): caps how many photos a single Assessment B generation call ever
 * sees. Bounds request cost/latency and matches the existing "cap what we send" precedent
 * (MAX_FREE_TEXT_CHARS) rather than trying to summarize an unbounded photo library.
 */
export const MAX_ANALYZABLE_PHOTOS = 4;

/** Media types the Claude vision API accepts. Anything else is skipped, not erred on. */
const SUPPORTED_PHOTO_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export interface AnalyzablePhoto {
  id: string;
  mimeType: string;
  data: Buffer;
}

export interface UploadMediaInput {
  kind: MediaKind;
  mimeType: string;
  data: Buffer;
  /** Client-reported capture time (offline capture may upload later). Defaults to now. */
  capturedAt?: string;
}

/**
 * Media capture, Phase 1 (issue #134): consent-enforced upload, per-family-encrypted
 * storage, listing, parent-initiated deletion, and the retention sweep. Storage only —
 * nothing here is analysed by Assessment A (never — CLAUDE.md §2 rule 7) or Assessment B
 * (Phase 2, issue #135, behind its own clinical sign-off).
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    @Inject(MEDIA_REPOSITORY) private readonly repository: MediaRepository,
    @Inject(OBJECT_STORAGE_SERVICE) private readonly storage: ObjectStorageService,
    @Inject(FAMILIES_REPOSITORY) private readonly familiesRepository: FamiliesRepository,
    // Explicit token: vitest's esbuild transform emits no decorator design:paramtypes
    // metadata, so class-typed constructor injection resolves to undefined in tests.
    @Inject(MediaEncryptionService)
    private readonly encryption: MediaEncryptionService,
  ) {}

  /**
   * CLAUDE.md §2 rule 9: no code path may store media without consent. Same shape as
   * AnalysisService.ensureAiAnalysisConsent — checked in the service (not only at the
   * HTTP boundary) so every caller, present or future, goes through it.
   */
  private async ensureMediaCaptureConsent(childId: string): Promise<void> {
    const granted = await this.familiesRepository.hasConsent(childId, 'media_capture');
    if (!granted) {
      throw new ForbiddenException(
        'Recording requires the media consent to be switched on first.',
      );
    }
  }

  async upload(childId: string, input: UploadMediaInput): Promise<MediaAsset> {
    // Also validated by UploadMediaDto at the HTTP boundary — re-checked here so the
    // service is safe for any caller/transport, not just the controller.
    if (!MEDIA_KINDS.includes(input.kind)) {
      throw new BadRequestException(`kind must be one of: ${MEDIA_KINDS.join(', ')}`);
    }
    await this.ensureMediaCaptureConsent(childId);

    const child = await this.familiesRepository.getChild(childId);
    if (!child) throw new NotFoundException(`No child found with id ${childId}`);

    // Per-family key, generated lazily on the family's first upload — never eagerly.
    let key = await this.repository.getFamilyMediaKey(child.family_id);
    if (!key) {
      key = this.encryption.generateKeyBase64();
      await this.repository.setFamilyMediaKey(child.family_id, key);
    }

    // Clamped to now: a claimed future capture time must not stretch the retention window.
    const now = new Date();
    const claimed = input.capturedAt ? new Date(input.capturedAt) : now;
    const capturedAt = Number.isNaN(claimed.getTime()) || claimed > now ? now : claimed;
    const retentionExpiresAt = new Date(
      capturedAt.getTime() + MEDIA_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    );

    // Encrypt BEFORE storage ever sees bytes; the key is opaque, not a path or URI.
    // AAD = childId: binds this blob to the child it belongs to, so it can't decrypt
    // successfully under a sibling's row within the same family (security review).
    const storageKey = `families/${child.family_id}/${randomUUID()}`;
    await this.storage.put(storageKey, this.encryption.encrypt(key, input.data, childId));

    return this.repository.create({
      childId,
      kind: input.kind,
      mimeType: input.mimeType,
      storageKey,
      capturedAt,
      retentionExpiresAt,
      // A fresh correlation id per capture, NOT a consent-grant record — it does not
      // reference any consent event, version, or timestamp, so it cannot itself prove
      // consent was granted. `ensureMediaCaptureConsent` above is the actual enforcement;
      // this field only lets a specific stored asset be correlated back to "an upload
      // that passed that check", for whatever manual audit Phase 1 needs (security
      // review, issue #134 — see docs/clinical-review/2026-07-16-issue134-media-capture-phase1.md).
      consentId: randomUUID(),
    });
  }

  list(childId: string): Promise<MediaAsset[]> {
    return this.repository.listByChild(childId);
  }

  /**
   * Decrypted photo evidence for Assessment B (issue #135, Phase 2 of the media-assessment
   * plan). Video/audio are explicitly out of scope for this phase — see
   * docs/clinical-review/2026-07-16-issue135-media-evidence-phase2.md.
   *
   * Consent here is silent-empty, not throwing (§15: "never analyse media without [consent]").
   * Unlike `upload`'s ensureMediaCaptureConsent, this is evidence-gathering consumed
   * internally by another service — the caller (AnalysisService) already independently gates
   * its whole call on ai_analysis consent; a missing media_capture consent should just mean
   * "no photo evidence available", the same fail-closed shape as every other optional
   * evidence source in this pipeline, not a hard failure of the narrative generation.
   */
  async getAnalyzablePhotos(childId: string): Promise<AnalyzablePhoto[]> {
    const consented = await this.familiesRepository.hasConsent(childId, 'media_capture');
    if (!consented) return [];

    const assets = await this.repository.listByChild(childId);
    const photos = assets
      .filter((a) => a.kind === 'photo' && SUPPORTED_PHOTO_MIME_TYPES.has(a.mimeType))
      .slice(0, MAX_ANALYZABLE_PHOTOS); // listByChild is already newest-capture-first

    if (photos.length === 0) return [];

    const child = await this.familiesRepository.getChild(childId);
    if (!child) return [];
    const key = await this.repository.getFamilyMediaKey(child.family_id);
    if (!key) return [];

    const out: AnalyzablePhoto[] = [];
    for (const asset of photos) {
      try {
        const encrypted = await this.storage.get(asset.storageKey);
        const data = this.encryption.decrypt(key, encrypted, childId);
        out.push({ id: asset.id, mimeType: asset.mimeType, data });
      } catch (error) {
        // Fail closed per-asset, not for the whole call — one corrupt/undecryptable blob
        // shouldn't take out every other photo's evidence (CLAUDE.md §8).
        this.logger.warn(
          `failed to decrypt media ${asset.id} for analysis — skipping`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
    return out;
  }

  /**
   * Parent-initiated delete-now: real deletion (blob + row), not a soft delete. The
   * tombstone-first ordering means a crash between steps leaves the asset invisible to
   * lists and queued for the retention sweep, never resurrected.
   */
  async deleteNow(childId: string, mediaId: string): Promise<void> {
    const asset = await this.repository.getByIdForChild(childId, mediaId);
    if (!asset) {
      throw new NotFoundException(`No media found with id ${mediaId}`);
    }
    await this.repository.markDeleted(mediaId, new Date());
    await this.storage.delete(asset.storageKey);
    await this.repository.deleteRow(mediaId);
  }

  /**
   * Daily retention sweep: hard-deletes (blob + row) everything past retentionExpiresAt
   * without a parent retain override, plus any tombstoned row a crashed delete left
   * behind. A failed blob delete keeps the row so tomorrow's run retries it.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async purgeExpired(now: Date = new Date()): Promise<void> {
    const due = await this.repository.listDueForDeletion(now);
    for (const asset of due) {
      try {
        await this.storage.delete(asset.storageKey);
        await this.repository.deleteRow(asset.id);
      } catch (error) {
        this.logger.error(
          `Retention sweep failed for media ${asset.id} — will retry next run`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
  }
}
