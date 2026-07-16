/**
 * Media capture (issue #134, Phase 1 of the media-assessment plan — see
 * docs/clinical-review/2026-07-16-issue133-media-assessment-plan.md).
 *
 * A MediaAsset is a stored, per-family-encrypted photo/video/audio observation. Phase 1
 * is capture + consent-gated storage ONLY: nothing here is read by Assessment A (which
 * never analyses media, CLAUDE.md §2 rule 7) or Assessment B (that wiring is Phase 2,
 * issue #135, behind its own clinical sign-off).
 */

export const MEDIA_KINDS = ['photo', 'video', 'audio'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/**
 * Parent-facing retention window options (issue #142, product plan §5 item 13). One
 * setting per family — shorter-only, so a caregiver can tighten how long a capture is
 * kept but never stretch it past the original 90-day default. Changing it is retroactive:
 * it recomputes `retentionExpiresAt` on every already-captured, non-retained asset under
 * the family, not just future captures — see MediaService.upload and
 * FamiliesRepository.updateMediaRetentionDays.
 */
export const MEDIA_RETENTION_DAY_OPTIONS = [30, 60, 90] as const;
export type MediaRetentionDays = (typeof MEDIA_RETENTION_DAY_OPTIONS)[number];
export const DEFAULT_MEDIA_RETENTION_DAYS: MediaRetentionDays = 90;

export interface MediaAsset {
  id: string;
  childId: string;
  kind: MediaKind;
  mimeType: string;
  /**
   * Opaque pointer the object-storage adapter maps to wherever the encrypted blob
   * actually lives (local disk in dev, S3-compatible bucket later) — never a raw
   * filesystem path or URL.
   */
  storageKey: string;
  capturedAt: string;
  /**
   * capturedAt + the retention window (fixed 90 days in Phase 1 — product plan §4.7).
   * The daily retention job hard-deletes past this unless retainedByParent is true.
   */
  retentionExpiresAt: string;
  /** True when the parent explicitly opted this capture out of auto-deletion. */
  retainedByParent: boolean;
  /**
   * A fresh UUID minted per capture, correlating a stored asset back to "an upload that
   * passed the media_capture consent check" — NOT a consent-grant record itself (it
   * carries no consent event, version, or timestamp, so it cannot alone prove consent was
   * granted). Actual enforcement is `MediaService.ensureMediaCaptureConsent` at upload
   * time (CLAUDE.md §2 rule 9); see docs/clinical-review/2026-07-16-issue134-media-capture-phase1.md.
   */
  consentId: string;
  /**
   * Set when deletion has started (parent delete-now or retention expiry) — a marked
   * row is invisible to lists and swept by the retention job if the blob/row removal
   * didn't complete in one pass. Deletion is always real: blob and row both go.
   */
  deletedAt: string | null;
}

/**
 * What the API actually returns to a caregiver's device. `storageKey` (an internal
 * object-storage pointer) and `consentId` (an internal correlation id, not consent proof —
 * see MediaAsset's own doc comment) are server-internal detail with no reason to leave the
 * backend (data minimization, security review, issue #134).
 */
export type MediaAssetView = Omit<MediaAsset, 'storageKey' | 'consentId'>;
