# Parent-facing media retention window (issue #142)

**Date:** 2026-07-16
**Content changed:** no question wording, weight, threshold, red-flag rule, or result/report
copy. What ships is a new privacy-setting control plus a handful of newly authored screen
strings — same shape as the Phase 1 media consent copy logged in
`2026-07-16-issue134-media-capture-phase1.md`, so it's logged here for the same reason.

## What shipped (engineering summary)

Media capture (issue #134) shipped with a fixed 90-day retention window
(`MEDIA_RETENTION_DAYS` in `apps/backend/src/media/media.service.ts`) and explicitly deferred
the parent-facing control to change it — product plan §5 item 13, "Privacy Controls." This PR
adds that control. Three scope questions from the #134 plan were resolved with the user
before writing any code: the setting is per-family, not per-capture (one
`media_retention_days` field on `Family` in `packages/shared-types/src/family.ts`, same shape
as `low_bandwidth_mode`, rendered in Consent Center next to the existing `media_capture`
`<ConsentToggle/>`, which is already family-wide); the range is shorter-only — 30, 60, or 90
days (`MEDIA_RETENTION_DAY_OPTIONS` in `packages/shared-types/src/media.ts`), with no option
to lengthen past the original 90-day default and no "keep forever" choice separate from the
existing per-capture `retainedByParent` override; and the change is retroactive. Changing the
setting (`PATCH /families/:familyId/media-retention`) recomputes
`retentionExpiresAt = capturedAt + days` on every already-captured, non-deleted, non-retained
`MediaAsset` under the family (`PrismaFamiliesRepository.updateMediaRetentionDays`), so a
caregiver who tightens the window sees it take effect on what they already recorded, not just
on future captures. An asset the parent explicitly retained (`retainedByParent: true`) is
never touched, matching the retention sweep's own exemption.

New captures (`MediaService.upload`) now read the family's configured window instead of the
fixed constant, falling back to the same 90-day default if the family lookup somehow comes
back empty. `MEDIA_RETENTION_DAYS` still exists and is still 90 — it's now the fallback/seed
value, re-exported from a new shared-types constant (`DEFAULT_MEDIA_RETENTION_DAYS`) so the
Family DB default and the fallback stay one source of truth.

**No change to Assessment A or B, red-flag rules, scoring, or any approved
label/support-term vocabulary.** Not a CLAUDE.md rule 16 architecture change.

## Newly authored user-facing copy (`packages/content/consent/copy.json`, new
`media_retention` key, version 1.0.0 → 1.1.0)

- Heading: "How long we keep recordings"
- Explanation: "Recordings and photos are automatically deleted after this many days,
  unless you choose to keep one yourself."
- Option label template: "{days} days"
- Locked-tier reason: "Available on Premium" (same string already used for the
  `media_capture`/`ai_analysis` toggles' locked state)

All pass the banned-words lint. None of it is result/report copy, but — same reasoning as
the #134 note — consent-adjacent privacy-setting wording is exactly what the §9 gate exists
to double-check before it ships to a caregiver.

## Verification

- New unit/integration coverage: `FamiliesService`/`InMemoryFamiliesRepository`
  (`apps/backend/test/families.integration.spec.ts`) for the default, the update, and the
  unknown-family 404; `apps/backend/test/families.http.spec.ts` for the 30/60/90 validation
  at the HTTP boundary; `apps/backend/test/media.integration.spec.ts` for a fresh upload
  using the family's configured window, a shortened window applying to a subsequent
  upload, the retroactive recompute on an already-captured asset, and the
  `retainedByParent` exemption from that recompute. Mobile:
  `ConsentCenterScreen.test.tsx` covers rendering, selection, free-tier lock, and guest
  hiding.
- Live-verified against real Postgres: registered a Premium account, uploaded a real photo
  (default 90-day `retentionExpiresAt`), shortened the family's window to 30 days via the
  new endpoint, confirmed the existing asset's `retentionExpiresAt` recomputed from
  `2026-10-14` to `2026-08-15` (`capturedAt + 30 days`), and confirmed a subsequent upload
  used the new 30-day window. Also verified live in the mobile web build (Metro):
  Consent Center renders "How long we keep recordings" with three selectable options for a
  Premium account, selecting "30 days" issues the PATCH and updates the highlighted
  selection, and the section is hidden entirely for a guest session.

## Sign-off status

_Pending_ advisor/maintainer sign-off — the newly authored heading/explanation/option-label
copy above, and whether shorter-only 30/60/90 (vs. also allowing longer windows, or an
explicit "keep until I delete it" choice) is the right range to offer.
