# Results screen restructure: Section A / Assessment B / Comparison UI (issue #104, CLAUDE.md §14, PR 2 of 2)

**Date:** 2026-07-12
**Content changed:** `comparison/copy.json` — new `card_heading` field ("How these compare").
No other new copy; this PR reuses `ai-results-summary/copy.json` v2.0.0's section headings
and framing note from PR 1 (`2026-07-11-dual-assessment-architecture.md`) unchanged.

## What changed

Closes the remaining CLAUDE.md §16 gap for issue #104: PR 1 (merged, `991882a`) shipped
Assessment B's full schema and the comparison-engine backend; this PR wires it into the
Results screen UI per §14's required layout.

- Deleted `AiResultsSummaryCard`, replaced with `<AIAssessmentCard/>` (CLAUDE.md §6).
- Added the three "not yet built" §6 components: `<ConfidenceBadge/>` (and refactored
  `<TrafficLightBar/>` to use it, per §6's explicit instruction, so both engines render
  confidence identically), `<SupportPrioritiesCard/>`, `<ComparisonCard/>`.
- `ResultsScreen.tsx` now renders three explicit, `testID`-verified, non-nested regions:
  `section-a-deterministic` (Assessment A — unchanged behavior, just wrapped),
  `section-b-ai-assessment` (Assessment B), `section-comparison` (the Comparison Section).
  `<ScreeningDisclaimer/>` stays outside all three, rendering unconditionally per §14's
  closing line.
- New mobile API client (`getComparisonResult`) chained off the AI summary fetch.

## The one new content string

`card_heading: "How these compare"` titles the Comparison Section, following the same
`packages/content/comparison/copy.json` file PR 1 already flagged `needs_clinical_signoff:
true`. Same placeholder status as everything else in that file — no new sign-off gate, just
one more string under the existing one.

## Engineering fix found during this PR's live verification (not clinical content)

Live browser testing surfaced a real crash unrelated to the UI restructure itself: a row
cached under the pre-v2 (issue #104 v1) shape crashed `isSummaryStillSafe` with an uncaught
TypeError (500) instead of failing closed, because `PrismaAnalysisRepository.
getCachedAiSummary` never validated the DB row's shape before trusting it. Fixed in
`ai-summary-schema.ts` by wrapping `isSummaryStillSafe` in try/catch — a shape mismatch is
now treated as a cache miss (regenerate) like any other unsafe/stale cache entry, not a
crash. Regression-tested. This is a pure bug fix, not a content or scoring change — noted
here only because it was found and fixed in the same PR.

## Not covered by this PR

- No new clinical content beyond the one heading string above.
- Locale/translation — English only, unchanged.
- Caching of the comparison result itself — still recomputed per request, as designed in PR 1.
