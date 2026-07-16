# Media evidence, Phase 3 — wiring stored video into Assessment B (issue #139)

**Date:** 2026-07-16
**Content changed:** no question wording, weight, threshold, or red-flag rule. What ships
is an architecture change under CLAUDE.md rule 16 (§2) — it changes which evidence
Assessment B ingests — plus a rewritten `results-summary` prompt and one schema value
(`evidenceModalities` gains `'video'`).

## What was asked, and the scope decisions made with the user first

Issue #139 is Phase 3 of the media-assessment plan
(`2026-07-16-issue133-media-assessment-plan.md`), extending Phase 2 (issue #135, merged) to
video. Unlike Phase 2, Claude's Messages API has no video content block — only `image` — so
this phase can't reuse the "attach the raw file" pattern at all. The issue arrived with three
open design questions explicitly left undecided; each was put to the user before any code
was written:

1. **What extracts frames from a stored video?** Answered: **`ffmpeg-static` + `fluent-ffmpeg`.**
   Bundles a static ffmpeg binary as an npm dependency — no system-level ffmpeg install
   needed on any server/host, keeping deploy as simple as it is today. The alternative
   (assuming a system ffmpeg binary) would have made every environment's setup a new,
   easy-to-forget requirement; a cloud transcoding API was ruled out as a third-party service
   dependency this app doesn't otherwise have.
2. **How many frames per video, and how chosen?** Answered: **3 frames, evenly spaced**
   (at 15%/50%/85% of the clip's duration — not exactly 0%/100%, since seeking to a clip's
   very first/last instant is a common ffmpeg edge case and often just a caregiver fumbling
   with the capture button). Deterministic and simple; motion-based scene-detection sampling
   was ruled out as harder to implement, harder to describe to the model, and harder to
   explain to an advisor for what it actually captures.
3. **When does extraction happen?** Answered: **on-demand at generation time, frames
   discarded after the call.** Matches the Phase 2 photo pattern exactly — decrypted bytes
   (and now derived frames) exist only in memory for the duration of one results-summary
   call, never persisted separately. Storing extracted frames at upload time would have
   created a second, longer-lived derived-media artifact needing its own encryption/
   retention/consent-withdrawal handling distinct from the source video's (rule 9, §2) — not
   worth the generation-time cost savings for this phase.

## What shipped (engineering summary)

- **`FrameExtractionService`** (`apps/backend/src/media/frame-extraction.ts`): a new port,
  mirroring the existing `ObjectStorageService`/`AiResultsSummaryClient` interface+token
  pattern. `FfmpegFrameExtractionService` (`ffmpeg-frame-extraction.service.ts`) is the real
  implementation — writes the decrypted video to a scratch temp file, ffprobes its duration,
  seeks to 3 evenly-spaced timestamps and extracts one JPEG frame at each via `fluent-ffmpeg`,
  then removes the temp directory in a `finally` block regardless of outcome. A per-frame
  extraction failure is skipped, not fatal to the other frames; a whole-video failure (e.g.
  corrupt/undecodable bytes) yields `[]`, the same fail-closed-per-asset shape as a
  corrupt photo in Phase 2. `FakeFrameExtractionService`
  (`src/media/testing/fake-frame-extraction.service.ts`) is the test double, so unit/
  integration tests never need to decode a real video file.
- **`MediaService.getAnalyzableVideoFrames(childId)`** (`media.service.ts`): mirrors
  `getAnalyzablePhotos` exactly — same silent-empty-without-consent shape, same
  newest-capture-first cap (`MAX_ANALYZABLE_VIDEOS = 2`, bounding total video-derived image
  blocks at 6 alongside the existing 4-photo cap), same per-family decryption. Frame
  extraction happens inline inside this method, right after decryption, and nothing it
  produces is ever written back to storage.
- **`AiResultsSummaryInput`** (`ai-summary-client.ts`) gained a required `videoFrames` field
  (`AiSummaryVideoFrameEvidence[]`: mime type + base64 bytes, shape identical to
  `AiSummaryPhotoEvidence`). `ClaudeAiResultsSummaryClient` now builds one `text` content
  block, then photo image blocks, then video-frame image blocks, all in the same single
  call — ordering matters, since the model maps blocks to the counts stated in the
  `<media_evidence>` tag positionally (no per-block labels exist in the Messages API).
- **`results-summary.md`** (the Assessment B prompt) now describes video-frame evidence and
  extends the existing still-frame discipline rule to cover it explicitly: each video-derived
  frame is one independent snapshot in time, never continuous footage/motion/sound, and
  multiple frames from the same clip must never be treated as showing a repeated or typical
  behaviour just because they share a source video. New video-specific bad/good example
  added alongside the existing photo one. `buildResultsSummaryUserMessage` now always states
  both the photo count and the video-frame count, in attachment order.
- **`AiResultsSummary.evidenceModalities`** (`packages/shared-types`): `EVIDENCE_MODALITIES`
  gains `'video'`. Computed deterministically by `AnalysisService.toEvidenceModalities` from
  what was actually sent to the call this time, never self-reported by the model — unchanged
  pattern from Phase 2, just extended.
- **Cache-busting**: the content hash now also includes the sorted, deduped set of *video
  asset ids* that contributed a frame (never raw video bytes or frame bytes) — deduped per
  asset rather than per frame, since extraction is deterministic for a given stored video, so
  hashing the asset id is enough to bust the cache when a video is captured or deleted.
- **Consent re-checked on every read**, identical to Phase 2: withdrawing `media_capture`
  after a video was already captured excludes it from the very next `results-summary` call.
- Red flags, Assessment A, and the Comparison Section are all untouched — same `Pick<>`-typed
  enforcement as Phase 2 means `evidenceModalities`/video evidence structurally can't leak
  into the comparison engine.
- Audio evidence remains explicitly NOT wired up — no transcription dependency exists in this
  backend yet; that's separate, undecided follow-up work.

## Live verification (not just unit tests)

Real backend against local Postgres, registered a Premium test account, granted
`data_storage`/`ai_analysis`/`media_capture` consent, generated a 3-second synthetic
`testsrc` color-pattern clip with ffmpeg itself, uploaded it via `POST /children/:childId/
media` as `kind: 'video'`, `video/mp4`, submitted one questionnaire answer (T2, toddler
vocabulary), then called `POST /children/:childId/results-summary` against a live
`ANTHROPIC_API_KEY` (no stub).

The real model received 3 extracted still frames and correctly described them without ever
claiming to have watched continuous footage: *"The three attached video-derived frames each
show a colour test card with no child visible, offering no usable developmental evidence."*
`uncertainty` likewise stated *"All three attached video frames show a colour test card
rather than the child, so no visual evidence about development is available"* — exactly the
still-frame discipline the prompt requires, correctly declining to invent content. No banned
word, reserved result label, or off-carve-out professional-referral language appeared.
`evidenceModalities` reported `["structured_answers", "video"]`.

Also verified live: a second call with no changes reused the cached narrative (`generatedAt`
identical, ~70ms); withdrawing `media_capture` consent dropped `"video"` from
`evidenceModalities` on the very next call (down to `["structured_answers"]`, ~19s
regeneration) even though the stored video asset remained; the Comparison Section
(`POST /children/:childId/comparison`) computed `partial_agreement` /
`insufficient_evidence` correctly afterward, unaffected by any of the above.

## What's explicitly NOT in this phase

- Audio evidence — no transcription dependency exists in this backend yet; wiring it is
  separate follow-up work, not implied by this change.
- Motion-based or scene-detection frame sampling — fixed evenly-spaced sampling only, per the
  scope decision above.
- Storing extracted frames anywhere — they exist only for the duration of one generation
  call and are never persisted as a new `MediaAsset` or cached artifact.
- Any change to how Assessment A scores, red-flag evaluation, or the comparison-reason
  heuristic — media never reaches Assessment A (rule 7, unchanged); video evidence isn't a
  new comparison disagreement reason in this phase.

## Sign-off status

_Pending_ advisor/maintainer sign-off — this is an architecture change under CLAUDE.md rule
16 (§2), same gate as Phase 2. Specifically flagged for review: the ffmpeg-static/
fluent-ffmpeg dependency choice, the 3-frames-evenly-spaced sampling decision, the
on-demand/discard-after-call extraction timing, the new video-frame prompt language in
`results-summary.md`, and the `evidenceModalities` schema addition.
