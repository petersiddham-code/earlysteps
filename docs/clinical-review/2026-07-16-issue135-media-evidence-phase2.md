# Media evidence, Phase 2 — wiring stored photos into Assessment B (issue #135)

**Date:** 2026-07-16
**Content changed:** no question wording, weight, threshold, or red-flag rule. What ships
is an architecture change under CLAUDE.md rule 16 (§2) — it changes which evidence
Assessment B ingests — plus a rewritten `results-summary` prompt and one schema field.

## What was asked, and the scope decision made with the user first

Issue #135 is Phase 2 of the media-assessment plan
(`2026-07-16-issue133-media-assessment-plan.md`): wiring Phase 1's stored `MediaAsset`s
(issue #134, consent-enforced encrypted capture/storage, no AI analysis) into Assessment B
as evidence. The plan document deliberately left the analysis approach undecided — "frame-
sampled description vs. a vision-capable model call vs. on-device pre-processing... is a
design question for that follow-up, not a decision to make speculatively now" — so two
scope questions were put to the user before any code was written:

1. **Which media kinds ship in this phase?** Answered: **photos only.** Claude's Messages
   API accepts images natively — no new dependency. Video needs frame-extraction tooling
   and audio needs transcription, neither of which exists anywhere in this backend today
   (CLAUDE.md: don't add a new framework/library without asking). Video/audio evidence is
   explicitly out of scope here, tracked as follow-up work, not silently dropped or implied
   as "coming later automatically."
2. **How does photo evidence reach the model?** Answered: **a direct vision call** — each
   photo is attached as an image content block in the SAME `results-summary` call that
   already handles free text, rather than a separate per-photo captioning call whose output
   gets folded back in as more text. One call, one guardrail block, and the model reasons
   about photo + text evidence together in a single synthesized narrative — a more direct
   fit for rule 13's synthesis requirement than describing a photo in isolation first.

## What shipped (engineering summary)

- **`MediaService.getAnalyzablePhotos(childId)`** (`apps/backend/src/media/media.service.ts`):
  returns up to `MAX_ANALYZABLE_PHOTOS` (4) decrypted, most-recently-captured photo assets
  whose mime type the Claude vision API accepts (`image/jpeg`, `image/png`, `image/webp`,
  `image/gif` — anything else is silently skipped, not erred on). Consent is checked here,
  gating on `media_capture` — unlike `upload`'s throwing `ensureMediaCaptureConsent`, this
  returns `[]` on a missing consent (evidence-gathering consumed internally by another
  service, not a direct user action; the caller already independently gates its whole call
  on `ai_analysis` consent). `MediaModule` now exports `MediaService` so `AnalysisModule` can
  inject it without duplicating storage/encryption/consent wiring.
- **`AiResultsSummaryInput`** (`ai-summary-client.ts`) gained a required `photos` field
  (`AiSummaryPhotoEvidence[]`: mime type + base64 bytes). `ClaudeAiResultsSummaryClient`
  builds one `text` content block (the existing prompt) plus one `image` content block per
  photo, filtered again to the same supported-mime-type set as a second line of defense.
- **`results-summary.md`** (the Assessment B prompt) now describes the media-evidence tag,
  instructs the model to treat each photo as exactly one still frame at one moment — never
  infer motion, sound, duration, frequency, or typicality beyond what's visibly in the
  frame — and extends the existing "synthesize, don't restate" rule with a photo-specific bad/
  good example. `buildResultsSummaryUserMessage` now always emits a `<media_evidence>` tag
  stating the attached photo count (0 if none), so the model gets a consistent frame whether
  or not photos exist this call.
- **`AiResultsSummary.evidenceModalities`** (new field, `packages/shared-types`): which
  evidence sources fed a given narrative — `structured_answers` / `free_text` / `photo`.
  Computed deterministically by `AnalysisService` from what was actually sent to the call,
  never self-reported by the model (so it can't drift from the truth or be spoofed by a
  model response) — same "stamped by the caller" pattern as `generatedAt`.
- **Cache-busting**: `AnalysisService`'s content hash now includes the sorted set of
  analyzed photo asset ids (never raw bytes), so capturing or deleting a photo invalidates
  the cached narrative even when the questionnaire answers haven't changed. Live-verified:
  a second call with no changes returns the identical cached `generatedAt` in ~20ms; adding
  a new photo triggers a fresh ~20s generation.
- **Consent re-checked on every read, not just at capture time**: withdrawing `media_capture`
  consent after a photo was already captured excludes that photo from the very next
  `results-summary` call, live-verified end to end — matches CLAUDE.md §15 ("Always require
  explicit, freshly-given consent before analysing... photographs; never analyse media
  without it").
- Red flags, Assessment A, and the Comparison Section are all untouched — `compareAssessments`
  reads a `Pick<AiResultsSummary, 'likelihood' | 'confidence' | 'uncertaintyFactors'>` that
  doesn't include `evidenceModalities`, so this change is invisible to it by construction
  (rule 7 enforced at the type level, unchanged from the 2026-07-11 dual-assessment work).

## Live verification (not just unit tests)

Ran the real backend against local Postgres with a live `ANTHROPIC_API_KEY` call (no stub):
registered a Premium test account, granted `data_storage`/`ai_analysis`/`media_capture`
consent, submitted three questionnaire answers (one with a free-text note about block play),
uploaded a synthetic photo depicting four stacked colored blocks, and called
`POST /children/:childId/results-summary`.

The real model correctly identified the photo's content ("a neatly stacked tower of four
coloured blocks"), synthesized it together with the caregiver's free-text note rather than
describing it in isolation, and correctly caveated it as a single still frame that "cannot
speak to frequency, context, or other developmental domains" — matching the prompt's
still-frame instruction exactly. `evidenceModalities` correctly reported
`["structured_answers", "free_text", "photo"]`. Also verified live: the Comparison Section
still computed correctly and unaffected; withdrawing `media_capture` consent dropped
`"photo"` from `evidenceModalities` on the next call even though the stored asset remained.

## What's explicitly NOT in this phase

- Video and audio evidence — no frame-extraction or transcription dependency exists in this
  backend yet; wiring them is separate follow-up work, not implied by this change.
- Any change to how Assessment A scores, or to red-flag evaluation — media never reaches
  Assessment A (rule 7, unchanged).
- Any change to the comparison-reason heuristic — photo evidence isn't a new comparison
  disagreement reason in this phase; the existing six reasons are untouched.

## Sign-off status

_Pending_ advisor/maintainer sign-off — this is an architecture change under CLAUDE.md rule
16 (§2: "Any change to Assessment B's likelihood/confidence output... is an architecture
change... plus explicit confirmation that rule 7's 'neither engine modifies the other'
boundary still holds"). Specifically flagged for review: the photos-only/direct-vision-call
scope decision above, the new `<media_evidence>` prompt language and still-frame instruction
in `results-summary.md`, and the `evidenceModalities` schema addition.
