# Media capture Phase 1 — consent enforcement, encrypted storage, retention (issue #134)

**Date:** 2026-07-16
**Content changed:** no question wording, weight, threshold, red-flag rule, or result/report
copy. What ships is consent-enforcement *behaviour* plus a handful of newly authored
screen strings — the issue #133 plan explicitly called out Phase 1's consent-enforcement
behaviour as needing its own sign-off when it shipped, so it's logged here.

## What shipped (engineering summary)

Phase 1 of the media-assessment plan (`2026-07-16-issue133-media-assessment-plan.md`, on
the issue #133 branch): the Observation Recorder screen (product plan Screen 6), backend
enforcement of the previously stored-but-ungated `media_capture` consent scope, per-family
AES-256-GCM encrypted blob storage behind a swappable `ObjectStorageService` (local-disk
driver shipped; S3 driver is a deliberate stub), and a daily retention job that
hard-deletes media 90 days after capture unless the parent retained it. Family deletion
("Delete everything", issue #55) now removes media blobs from object storage as well as
the DB rows.

**No AI analysis of media exists anywhere in this change.** Assessment A never sees media
(CLAUDE.md §2 rule 7, unchanged); Assessment B wiring is Phase 2 (issue #135), behind its
own prompt rewrite and sign-off. Nothing recorded here feeds either engine.

## Consent-enforcement behaviour (the part needing review)

- Upload is 403-refused server-side unless the family's `media_capture` consent flag is
  on at that moment — checked inside `MediaService` per upload (same shape as the
  `ai_analysis` gate), not just in the UI. Nothing is written on refusal.
- Each stored capture records a fresh `consentId` UUID — a correlation id linking a
  stored asset back to "an upload that passed the consent check above," not a
  consent-grant record itself (it carries no consent event, version, or timestamp, so it
  cannot alone prove consent was granted). The actual enforcement is the 403 check, not
  this field. Never returned to the client (server-internal only, per the security review
  below).
- Tier: the media endpoints carry the same JWT + Premium + family-ownership guards as the
  AI endpoints, closing the backend half of issue #123's UI-only tier gate.
- Retention: fixed 90 days from capture, daily hard-delete sweep (blob + row), parent
  delete-now endpoint. No parent-facing retention setting yet (out of scope, per plan).

## Security review (pre-PR pass, `earlysteps-security` agent)

No critical/high findings. Two changes made in response and reflected in the code:
1. **AAD binding**: `MediaEncryptionService.encrypt`/`decrypt` now takes `childId` as AES-GCM
   additional authenticated data. Without it, two children in the *same* family share one
   encryption key, so a blob mistakenly or maliciously associated with the wrong sibling's
   DB row would still decrypt "successfully" (only the DB row bound blob to child, not the
   crypto). With AAD, that mismatch now fails the auth-tag check.
2. **Data minimization**: `storageKey` (an internal object-storage pointer) and `consentId`
   were previously returned in the API response body. Neither is exploitable as designed
   (storage paths are server-generated and access-guarded), but there was no reason for
   either to leave the backend. The API now returns `MediaAssetView`
   (`packages/shared-types/src/media.ts`), which omits both.

One accepted, documented-only limitation: the per-family AES key lives in `Family.mediaEncryptionKey`
in the same Postgres database as the `storageKey` pointers, and with the default
`STORAGE_DRIVER=local`, blobs sit on the same host filesystem. This means database access
alone yields both the key and the pointer to every blob — "per-family encrypted" is real
isolation between families, but it is not independent-system key separation. That only
materializes once the (currently stubbed) S3 driver is wired to a genuinely separate store
or a real KMS is introduced — out of scope for Phase 1, called out here so it isn't read as
stronger at-rest isolation than it actually provides.

## Newly authored user-facing copy (inline screen strings, not packages/content)

- Observation Recorder: heading "Add a photo, video, or sound clip", the calm consent
  reminder ("Recording is always your choice" / encrypted, kept 90 days, deletable), the
  capture button labels, the "Skip — I'll describe instead" affordance, the
  permission-declined and upload-failure messages, and the free-tier locked-state copy.
- Results screen: the new "Add a photo, video, or sound clip" entry-point button
  (Premium, server-persisted child only).
- Backend 403 message: "Recording requires the media consent to be switched on first."

All pass the banned-words lint; none of it is result/report copy, but the consent-adjacent
wording is exactly the kind of thing the §9 gate exists to double-check.

## Sign-off status

_Pending_ advisor/maintainer sign-off — consent-enforcement behaviour and the new screen
copy above. Engineering-only pieces (storage adapter, encryption format, cron plumbing)
don't need the gate.
