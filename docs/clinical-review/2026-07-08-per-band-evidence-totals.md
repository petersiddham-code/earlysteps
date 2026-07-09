# 2026-07-08 — Evidence gate & confidence measured against the child's own band (issue #52)

**Content version:** none (no floor values, weights, or wording changed)
**Status:** ⛔ awaiting advisor sign-off (gate behaviour change + coverage findings)

## What issue #52 found

In one run, "repetitive/self-regulating behaviours" showed "Not enough information yet"
despite 2 clearly concerning answers, while "sensory needs" reached medium confidence with
a comparable number of answers.

## Root cause (engineering defect, now fixed)

The minimum-evidence gate was designed (2026-07-02, issue #22) to cap its per-domain floor
at "how many scored questions this child can actually be asked" — and the engine supported
that — but the backend never supplied those totals, so the engine fell back to counting
weighted questions across **all five banks combined**, a number no single child can reach.
The #22 note listed "per-age-band floors not wired" as a known gap; this closes it.

Effect of the fix (`domainQuestionTotalsForBand`, universal + own band):

1. **Gate:** a domain the band can never give 3 scored answers for (e.g. toddler
   repetitive behaviours: exactly 2 questions, T10+T11) now surfaces once everything
   available is answered, instead of being gated forever while its "Answer more
   questions" CTA pointed at questions that don't exist.
2. **Confidence:** completeness is now answered ÷ band-available (was: answered ÷
   all-bank), so equally-answered domains reach comparable confidence. The
   `MIN_ANSWERS_FOR_MEDIUM = 3` cap is untouched: a 2-of-2 domain opens the gate but
   stays **low** confidence — thin evidence still reads as thin.

No floor values changed (still 3 per domain / 10 overall, placeholder). The floor-capping
semantics were already documented in the engine; this wires them up.

## Coverage findings for the advisor (the content half of #52)

Weighted (scoring-eligible) questions per domain each band can be asked, as of weights
0.5.0-placeholder — entries **below the floor of 3** marked •:

| Domain | toddler | preschool | primary | teen | young_adult |
|---|---|---|---|---|---|
| social | 9 | 7 | 5 | 3 | 3 |
| communication | 4 | 6 | 3 | 2 • | 2 • |
| sensory | 4 | 3 (2 • before P22, #78) | 3 (1 • before PR18/PR19, #78) | 3 (1 • before TE15/TE16, #78) | 3 (1 • before YA13/YA14, #78) |
| repetitive_behaviour | 2 • | 3 | 3 | 2 • (3 after TE13, PR #60) | 2 • |
| attention | 1 • | 1 • | 1 • | — | — |
| emotional_regulation | 1 • | 1 • (0 before P21, #65) | 2 • (1 • before PR17, #65) | 3 (2 • before TE14, #65) | 3 (2 • before YA12, #65) |
| learning | — | 1 • | 1 • | 1 • | — |
| daily_living | — | — | 1 • | 1 • | 1 • |

With the fix these sparse pairs surface (at low confidence) once fully answered — but the
real remedy is **more questions per sparse domain per band**, especially teen/young-adult,
per product-plan requirement #5. That is content authoring needing advisor input; tracked
in `content-gaps.md`. TE13 (issue #54, PR #60) already adds one teen repetitive item. The
sleep questions added for issue #65 (P21/PR17/TE14/YA12) were authored to close the
`severe_sleep` red-flag coverage gap, not primarily to fix this table — but they land in
`emotional_regulation` and happen to bring teen and young_adult up to the floor there.
Issue #78 closed sensory in every band — see
`2026-07-09-sensory-coverage-preschool-primary-teen-young-adult.md`. Sensory was the
sharpest drop-off in this table; attention is now the highest-priority remaining gap.
