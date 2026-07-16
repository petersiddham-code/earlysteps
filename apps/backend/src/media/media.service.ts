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
import {
  DEFAULT_MEDIA_RETENTION_DAYS,
  MEDIA_KINDS,
  type MediaAsset,
  type MediaKind,
} from '@earlysteps/shared-types';
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
import {
  FRAME_EXTRACTION_SERVICE,
  type FrameExtractionService,
} from './frame-extraction.js';

/**
 * Default retention window (product plan §4.7): capturedAt + 90 days, then the daily job
 * below hard-deletes unless the parent explicitly retained the capture. Issue #142 added a
 * parent-facing setting (Family.media_retention_days, 30/60/90) that overrides this per
 * family — this constant is now only the fallback/seed value, re-exported from
 * shared-types so it stays a single source of truth with the Family default.
 */
export const MEDIA_RETENTION_DAYS = DEFAULT_MEDIA_RETENTION_DAYS;

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

/**
 * Phase 3 (issue #139): caps how many stored videos a single Assessment B generation call
 * ever attempts to extract frames from. Each video already yields up to FRAMES_PER_VIDEO
 * (3) image blocks, so this bounds total video-derived image blocks the same way
 * MAX_ANALYZABLE_PHOTOS bounds photos — cost/latency, not an arbitrary content decision.
 */
export const MAX_ANALYZABLE_VIDEOS = 2;

/**
 * Video mime types this backend knows how to feed to ffmpeg for frame extraction.
 * Matches what the mobile capture screen actually produces (`video/mp4`) plus the other
 * common container types a caregiver's device might report. Anything else is skipped, not
 * erred on — same "silently skip, don't fail the whole call" precedent as photo mime types.
 */
const SUPPORTED_VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);

export interface AnalyzableVideoFrame {
  /** Which stored video this frame was sampled from — used only for cache-busting
   * (hashAnsweredQuestions), never sent to the model. */
  videoAssetId: string;
  mimeType: 'image/jpeg';
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
    // Same explicit-token reasoning (issue #139): lets tests substitute
    // FakeFrameExtractionService without invoking real ffmpeg.
    @Inject(FRAME_EXTRACTION_SERVICE)
    private readonly frameExtraction: FrameExtractionService,
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
    // Issue #142: the family's configured window (default 90) rather than the fixed
    // constant — falls back defensively if the family lookup somehow comes back empty.
    const family = await this.familiesRepository.getFamily(child.family_id);
    const retentionDays = family?.media_retention_days ?? DEFAULT_MEDIA_RETENTION_DAYS;
    const retentionExpiresAt = new Date(
      capturedAt.getTime() + retentionDays * 24 * 60 * 60 * 1000,
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
   * Decrypted, frame-extracted video evidence for Assessment B (issue #139, Phase 3 of the
   * media-assessment plan). Same consent shape as getAnalyzablePhotos — silent-empty on a
   * missing media_capture consent, not throwing, since this is evidence-gathering consumed
   * internally by AnalysisService, which already independently gates its whole call on
   * ai_analysis consent.
   *
   * Frame extraction (FrameExtractionService) happens on demand, right here, from bytes
   * decrypted only for the duration of this call — nothing extracted is ever written back
   * to storage or cached as a new MediaAsset (the user's "on-demand, discard after the
   * call" scope decision, confirmed before implementation). A video that fails to probe/
   * decode contributes zero frames, not an error for the whole call (fail closed per-asset,
   * same precedent as a corrupt photo).
   */
  async getAnalyzableVideoFrames(childId: string): Promise<AnalyzableVideoFrame[]> {
    const consented = await this.familiesRepository.hasConsent(childId, 'media_capture');
    if (!consented) return [];

    const assets = await this.repository.listByChild(childId);
    const videos = assets
      .filter((a) => a.kind === 'video' && SUPPORTED_VIDEO_MIME_TYPES.has(a.mimeType))
      .slice(0, MAX_ANALYZABLE_VIDEOS); // listByChild is already newest-capture-first

    if (videos.length === 0) return [];

    const child = await this.familiesRepository.getChild(childId);
    if (!child) return [];
    const key = await this.repository.getFamilyMediaKey(child.family_id);
    if (!key) return [];

    const out: AnalyzableVideoFrame[] = [];
    for (const asset of videos) {
      try {
        const encrypted = await this.storage.get(asset.storageKey);
        const data = this.encryption.decrypt(key, encrypted, childId);
        const frames = await this.frameExtraction.extractFrames(data, asset.mimeType);
        for (const frame of frames) {
          out.push({
            videoAssetId: asset.id,
            mimeType: frame.mimeType,
            data: frame.data,
          });
        }
      } catch (error) {
        this.logger.warn(
          `failed to decrypt/extract frames from media ${asset.id} for analysis — skipping`,
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
