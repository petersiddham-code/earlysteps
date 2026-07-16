# 2026-07-16 — Recommendation-tier crosswalk signed off (issue #130)

**Content version:** none (no wording, floor, or weight changed — sign-off only)
**Status:** ✅ signed off — Peter Siddham, 2026-07-16 (see "Advisor sign-off" below)

## What issue #130 found

`recommendationTier.ts` carried two heuristics flagged as placeholder judgment calls
rather than validated clinical thresholds (`docs/clinical-review/content-gaps.md` §5):

1. `deriveRecommendationTier`: a red-flag-free `SupportLevelEstimate` of `high` maps to
   `"Formal assessment is recommended"` — the same tier a red flag would produce, minus
   the urgency escalation. The product plan specifies red flags must trigger a
   recommendation but never specifies this crosswalk.
2. `deriveRecommendationConfidence`: any red-flag-forced tier reports `high` confidence
   regardless of how sparse the rest of the intake is.

## Correction: item 2 was already signed off

Item 2 is the same heuristic issue #64 shipped and got signed off on 2026-07-09 — see
`2026-07-09-recommendation-confidence.md` and the README sign-off log row for that date
("✅ signed off 2026-07-09 — high-confidence framing confirmed correct for red-flag-forced
recommendations"). Issue #130 restated it as still pending; that was stale by the time
#130 was filed, not a real gap. No new sign-off needed for
`deriveRecommendationConfidence` — this entry only closes out item 1.

## The heuristic signed off here

**A `high` support estimate alone, with zero red flags present, recommends formal
assessment** (`"Formal assessment is recommended"`, not the urgent
`"...strongly recommended soon"` tier — that escalation stays exclusive to red flags).
Rationale for the rule as originally written: `high` is the ceiling of the support-level
scale, and treating it as equivalent to "next step is a formal look" is a reasonable
reading of what a `high` support estimate implies even without a red-flag-triggering
answer on file.

## Advisor sign-off (2026-07-16, Peter Siddham)

Confirmed: the current rule is correct as implemented. A red-flag-free `high` support
estimate should continue to map to `"Formal assessment is recommended"`. No change
requested to `deriveRecommendationTier`.

## What did NOT change

No result-copy wording, no evidence floor, no scoring weight, no red-flag trigger
definition, no code behavior. `packages/scoring-engine/src/recommendationTier.ts`'s
docblock is updated to drop the "placeholder, pending clinical review" language for both
heuristics now that both are signed off.
