# 2026-07-09 — Recommendation confidence surfaced end-to-end (issue #64)

**Content version:** none (no wording, floor, or weight changed — new field + new heuristic only)
**Status:** ⛔ awaiting advisor sign-off (the red-flag-implies-high-confidence heuristic below)

## What issue #64 found

The Results screen showed recommendations like **"Formal assessment is recommended"** with
no confidence level next to them at all — CLAUDE.md §2 rule 3 requires support-level terms
to always be paired with a confidence, and the same principle plainly applies to the
recommendation tier, which is the single most consequential line on the screen. Missing
confidence can read as more certain than the evidence supports, especially when few
answers exist.

## Root cause

`ResultsView.recommendationTier` (`packages/shared-types/src/resultsView.ts`) had no
paired confidence field at all. `apps/mobile/.../ResultsScreen.tsx` showed a confidence
next to `supportLevel` (the support-need term) but never next to `recommendationTier` —
and when a red flag forced a tier with no support estimate present (`supportLevel` null),
there was no confidence anywhere on the recommendation.

## Fix

1. New `deriveRecommendationConfidence(redFlags, supportEstimate)` in
   `packages/scoring-engine/src/recommendationTier.ts`, mirroring
   `deriveRecommendationTier`'s branching exactly so a null tier and a null confidence
   always travel together:
   - any red flag present → **`high`** (see heuristic below)
   - no red flag, a (gate-checked) support estimate present → that estimate's own
     confidence (the same number already shown next to `supportLevel`)
   - no red flag, no estimate (insufficient overall evidence) → `null`
2. New `ResultsView.recommendationConfidence: Confidence | null` field, populated in
   `apps/backend/src/screening/results-view.ts::toResultsView`.
3. Mobile Results screen now renders `Confidence: {level}` beside the recommendation
   text, and explicitly renders `Confidence: low` in the "not enough information yet"
   state (previously that state showed no confidence indicator of any kind — but it is
   definitionally low, so this is stated fact, not an invented number).

## The heuristic needing sign-off

**A red-flag-forced recommendation always reports HIGH confidence**, even when the
overall domain evidence is otherwise insufficient (e.g. a single red-flag-triggering
answer with nothing else answered). Rationale: a red-flag rule fires on one explicit,
direct answer to a direct question — not a weighted average across many answers — so
the general evidence-sparsity concern that governs domain/support confidence doesn't
apply the same way here. The alternative (reporting the red flag's recommendation at the
same confidence as the mostly-empty domain estimate, or as `null`) risks a caregiver
reading a serious, plainly-stated sign as unreliable or absent, which is the opposite of
what CLAUDE.md §2 rule 8 (red flags can never be averaged away) intends.

This is the same category of placeholder judgment call already flagged in
`recommendationTier.ts` (the "high support estimate also recommends assessment" rule) —
not a clinically validated threshold, a reasonable engineering interpretation pending
review. Advisor should confirm "high confidence" is the right framing for a red-flag-only
recommendation, as opposed to a dedicated wording that avoids the confidence vocabulary
entirely for flag-driven tiers.

## What did NOT change

No result-copy wording, no evidence floor, no scoring weight, no red-flag trigger
definition. `Confidence: low/medium/high` uses the existing approved `Confidence`
vocabulary (CLAUDE.md §2 rule 3) — no new label was invented.
