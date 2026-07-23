# Media evidence, Phase 4 — wiring stored audio into Assessment B (issue #140)

**Date:** 2026-07-23
**Content changed:** no question wording, weight, threshold, or red-flag rule. What ships
is an architecture change under CLAUDE.md rule 16 (§2) — it changes which evidence
Assessment B ingests — plus a rewritten `results-summary` prompt and two schema values
(`evidenceModalities` gains `'audio'`, `uncertaintyFactors` gains
`'unclear_audio_transcript'`).

## What was asked, and the scope decisions made with the user first

Issue #140 is Phase 4 of the media-assessment plan
(`2026-07-16-issue133-media-assessment-plan.md`), extending Phase 2 (photos, issue #135)
and Phase 3 (video, issue #139) to audio. Unlike photos/video, Claude's Messages API has no
audio content block at all, so an audio `MediaAsset` needs a text transcript before it can
reach Assessment B in any form. The issue arrived with three open design questions
explicitly left undecided; each was put to the user before any code was written:

1. **Where is audio transcribed, and with what engine?** Answered: **a cloud STT API
   (OpenAI, `whisper-1`), server-side.** Weighed against a self-hosted model (mirroring
   Phase 3's ffmpeg precedent — no third-party data flow, but a real new CPU/model-bundling
   cost) and on-device transcription (strongest privacy story, but a mobile-app change that
   breaks from every other media-evidence phase's server-side pattern). The cloud-API
   choice trades a new third-party data flow (raw audio leaves this backend for one
   transcription call) for much lower backend compute cost and a simple deploy — the same
   kind of tradeoff already accepted for the note that Assessment B's photo/video calls send
   raw caregiver media to Anthropic's API today.
2. **Is the transcript cached, or regenerated every call?** Answered: **cached,
   permanently, on the `MediaAsset` row** (`transcript`/`transcribedAt` columns), the
   opposite of Phase 3's video-frame precedent. Frame extraction is cheap enough to redo
   on every call; speech-to-text is not, and the underlying audio for a given stored asset
   never changes, so a transcript computed once is valid forever until the asset is
   deleted. A transcript is generated lazily, the first time an asset is read as evidence,
   never at upload time.
3. **How does a transcript get treated evidentially?** Answered: **its own tagged evidence
   type (`audio`), never folded into `free_text`.** This follows the precedent already set
   by `EVIDENCE_MODALITIES`'s own doc comment (photo/video are already kept distinct from
   free text) and directly answers the issue's concern that a transcript is not something
   the caregiver typed and must not be treated as more reliable than a machine
   transcription actually is. A new uncertainty factor, `unclear_audio_transcript`, was
   added to `UNCERTAINTY_FACTORS` so the model has an explicit, structured way to flag a
   garbled, ambiguous, or non-speech recording rather than silently best-guessing at its
   content or silently ignoring it.

## What shipped (engineering summary)

- **`AudioTranscriptionService`** (`apps/backend/src/media/audio-transcription.ts`): a new
  port, mirroring the existing `FrameExtractionService`/`ResponseAnalysisClient`
  interface+token+`Disabled*` pattern. `OpenAiAudioTranscriptionService`
  (`openai-audio-transcription.service.ts`) is the production implementation (official
  `openai` SDK, `whisper-1`); `DisabledAudioTranscriptionService` is wired when no
  `OPENAI_API_KEY` is configured, matching the existing `ANTHROPIC_API_KEY`-gated
  offline-first precedent in `AnalysisModule`. `FakeAudioTranscriptionService`
  (`src/media/testing/`) is the test double.
- **`MediaAsset` gains `transcript`/`transcribedAt`** (`packages/shared-types/src/media.ts`,
  new Prisma migration `20260723115538_add_audio_transcript`) — both excluded from
  `MediaAssetView`, the same data-minimization treatment as `storageKey`/`consentId`; the
  mobile app has no use for a machine transcript of its own recording.
- **`MediaService.getAnalyzableAudioTranscripts(childId)`**: mirrors
  `getAnalyzablePhotos`/`getAnalyzableVideoFrames`'s consent shape (silent-empty without
  `media_capture` consent) and cap precedent (`MAX_ANALYZABLE_AUDIO_CLIPS = 2`, newest
  captured first). Unlike the other two, it checks `asset.transcript` first and only
  decrypts + calls the transcription service for assets that don't have one yet,
  persisting the result via a new `MediaRepository.setTranscript`.
- **`AiResultsSummaryInput` gained `audioTranscripts`** (`ai-summary-client.ts`): plain
  transcript text, not image content — attached inside the text message as a new
  `<audio_evidence>` tag (`prompt.ts`), separate from `<media_evidence>`'s photo/video
  counts, since a transcript carries actual content the model needs to read, not just a
  count.
- **`results-summary.md`** (the Assessment B prompt) now describes audio-transcript
  evidence: explicitly a machine transcription of recorded speech, never caregiver-typed
  text and never to be quoted back verbatim; instructs the model to name
  `unclear_audio_transcript` and say so in `uncertainty` rather than guessing at unclear
  content. New audio-specific bad/good example alongside the existing photo/video ones.
- **`AiResultsSummary.evidenceModalities`** gains `'audio'`; **`UNCERTAINTY_FACTORS`** gains
  `'unclear_audio_transcript'` (`packages/shared-types`). Both computed/selected the same
  fail-closed, caller-computed-or-schema-validated way as the existing members — never
  self-reported freely by the model outside the fixed enum.
- **Cache-busting**: the results-summary content hash now also includes the sorted set of
  *audio asset ids* that contributed a transcript (never transcript text) — same
  id-based-not-content-based precedent as photo/video ids.
- **Consent re-checked on every read**, identical to Phase 2/3: withdrawing
  `media_capture` after a clip was already captured excludes it from the very next
  `results-summary` call, even though its cached transcript remains on the row.
- Red flags, Assessment A, and the Comparison Section are all untouched — same `Pick<>`-
  typed enforcement as Phase 2/3 means audio evidence structurally can't leak into the
  comparison engine.

## QA fix: verbatim transcript quoting (found post-merge-candidate, fixed same PR)

Codex QA (parallel live-verification session, PR #147) caught a real gap the prompt alone
didn't close: for a very short transcript (a single word, "Oh"), the model quoted it back
verbatim in caregiver-facing text — `('Oh')` inside both `reasoning`/`why-this-read` and
`uncertainty`/`what's-uncertain` sections. This directly violates the "never quote it back
verbatim" instruction added for this phase, and the shorter the transcript, the more likely
the model reaches for a literal quote since there's little else to say.

Fixed with a deterministic runtime check, `containsVerbatimTranscriptQuote`
(`ai-summary-schema.ts`), added to the same fail-closed content-safety gate that already
catches banned words/reserved labels — every long-text field, plus
`professionalAssessmentPriorities`, is checked against each audio transcript actually sent
this call, wrapped in quote marks or parentheses (`('...')`, `"..."`, etc.), case-
insensitive, tolerant of trailing punctuation inside the quote. A match fails the
generation the same way a banned word does: discarded and retried (up to
`MAX_SUMMARY_GENERATION_ATTEMPTS`), then fails closed (section doesn't render) if every
attempt still quotes it. Wired into both `parseAiSummaryOutput` (fresh generations) and
`isSummaryStillSafe` (re-validating a cached narrative on every read), the same "check the
cache against today's rules" precedent PR #105 established for banned words. Also
strengthened `results-summary.md` itself to explicitly call out short/single-word
transcripts as still subject to the no-quoting rule, with a worked example.

New regression test in `ai-results-summary.integration.spec.ts`: a stubbed model output
that quotes a one-word transcript verbatim is confirmed to fail closed (`null`, no cached
row written) rather than reaching a caregiver's screen.

## Live verification (not just unit tests)

Real backend against local Postgres, registered a Premium test account, granted
`data_storage`/`ai_analysis`/`media_capture` consent, submitted one questionnaire answer
(T2, toddler vocabulary), recorded a short real speech clip via macOS `say` + `afconvert`
("The child pointed at the ball and said ball twice."), uploaded it as `kind: 'audio'`,
`audio/m4a`, then called `POST /children/:childId/results-summary` against a live
`ANTHROPIC_API_KEY` and a live `OPENAI_API_KEY` (no stubs on either side).

**Fail-closed path, verified first (before the OpenAI account had billing configured):**
the upload succeeded, `results-summary` still completed successfully with no audio
evidence, `evidenceModalities` correctly omitted `"audio"`, a
`OpenAiAudioTranscriptionService` warning was logged (`audio transcription failed:
Connection error`), and nothing crashed — exactly the fail-closed contract CLAUDE.md §8
requires. (Root cause of that specific error, confirmed via direct `curl`: the OpenAI
account's card was attached but had a **$0 credit balance** — auto-recharge only
replenishes an *existing* balance below its trigger threshold, it never seeds an initial
one. Diagnosed live via Playwright against the OpenAI billing dashboard; resolved once the
user completed an initial credit purchase.)

**Real transcription path, verified after billing was fixed:** the same call now returned
`"evidenceModalities": ["structured_answers", "audio"]`, and `uncertaintyFactors` correctly
included `"unclear_audio_transcript"` even for a clean recording — the model treated the
transcript with the cautious framing the prompt requires rather than over-trusting it.
`developmentalProfile` read *"The transcribed recording suggests he may be using at least
one word functionally and with a communicative gesture, which is a positive indicator,
though the transcript's precision cannot be fully relied upon"* — synthesized, not a
verbatim restatement of the transcript (rule 13, §2's Guiding Principle). No banned word,
reserved result label, or off-carve-out professional-referral language appeared.

Also verified live: querying the dev database directly confirmed the transcript
(`"The child pointed at the ball and said ball twice."`) was persisted on the
`MediaAssetRecord` row after the first call; a second `results-summary` call (after adding
a new answer to bust the summary cache) reused the identical `transcribedAt` timestamp and
produced no new transcription warning/log line, confirming the clip was **not**
re-transcribed — the "cache it" scope decision working as designed.

## What's explicitly NOT in this phase

- Non-audio, non-video, non-photo modalities (eye tracking, facial expression, gesture,
  movement) — future work per CLAUDE.md §15, not implied by this change.
- Any change to how Assessment A scores, red-flag evaluation, or the comparison-reason
  heuristic — audio evidence isn't a new comparison disagreement reason in this phase.
- **A pre-existing, unrelated bug found incidentally during test-data cleanup**: family
  deletion (`DELETE /families/:familyId`, the issue #55 right-to-erasure endpoint) 500s with
  a Prisma foreign-key violation (`AiResultsSummaryRecord_childId_fkey`) for any family whose
  child has ever generated a cached AI results summary —
  `PrismaFamiliesRepository.deleteFamily` never deletes `AiResultsSummaryRecord` rows before
  deleting the child. This predates issue #140 entirely (the model was added in issue #104)
  and is not touched by this change; flagged separately to the user as its own follow-up,
  not fixed here to keep this PR's diff scoped to the audio-evidence architecture change.

## Sign-off status

_Pending_ advisor/maintainer sign-off — this is an architecture change under CLAUDE.md rule
16 (§2), same gate as Phase 2/3. Specifically flagged for review: the cloud-STT-over-
self-hosted-model dependency choice (a new third-party data flow for raw caregiver audio),
the permanent-transcript-caching decision, the new `unclear_audio_transcript` uncertainty
factor, the new `<audio_evidence>` prompt language, and the `evidenceModalities`/
`uncertaintyFactors` schema additions.
