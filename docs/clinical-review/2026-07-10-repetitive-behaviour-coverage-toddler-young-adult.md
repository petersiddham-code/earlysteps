# 2026-07-10 — Repetitive-behaviour coverage: toddler/young_adult (issue #81)

**Content version:** questions toddler 1.4.0 / young_adult 1.6.0 / weights 0.8.0-placeholder
**Status:** ⛔ awaiting advisor sign-off

## What issue #81 found

Repetitive_behaviour was the last remaining gap in the per-band coverage matrix
(`content-gaps.md` §10 / `2026-07-08-per-band-evidence-totals.md`): toddler and
young_adult each had 2 scored repetitive_behaviour items, one short of the 3-item evidence
floor from issue #52. TE13 (issue #54, PR #60) had already closed the equivalent gap for
teen; this closes the two residual bands.

## What changed

One newly authored question per band (toddler, young_adult — 2 total), grounded in RBQ
(Repetitive Behaviour Questionnaire) and AQ restricted-interests constructs. Wording is our
own; no licensed instrument text copied.

- **T24** (toddler) — restricted/intense interest: unusually strong fixation on specific
  objects or topics (spinning wheels, letters, a particular toy) compared to typical
  toddler play. Distinct from T10 (motor stereotypies — hand-flapping, rocking, spinning)
  and T11 (distress at small changes/insistence on sameness). Inserted after T11 so the
  repetitive-behaviour cluster reads together, same convention as TE13. Hint frames it as a
  possible strength, mirroring YA5's existing framing for the same construct at the
  young_adult end of the age range.
- **YA16** (young_adult) — repetitive movement/speech (stimming): rocking, pacing,
  hand/finger movements, repeating phrases, humming. Mirrors TE13's structure and option
  list exactly (same chip_multi_select, same option ids) since young_adult had the same gap
  TE13 closed for teen — YA5 (intense interests) and YA6 (routine-change distress) don't
  cover motor/vocal stimming. **Masking-aware hint**, per the issue's explicit instruction
  and the precedent TE13 set: "Many people learn to hold this in around others and let it
  out more in private — what you notice at home counts too." `allow_free_text: true`, same
  rationale as TE13 and the six sensory questions from 2026-07-02.

**Placeholder weights** added for both:
- T24: `max` combine, `yes_very_intense: 8` / `somewhat: 3`, mirroring YA5's existing weight
  pattern for the same restricted-interest construct.
- YA16: `sum` combine, 5 per selected behaviour (`something_else` included, unweighted
  `none_noticed`/`not_sure`), identical to TE13's weight shape.

Same NOT-CLINICALLY-VALIDATED status as every other weight in `domain-weights.json`.

## Result

Repetitive_behaviour now reaches the 3-item evidence floor in every band (pinned in
`packages/content/src/questionTotals.test.ts`, "pins issue #81" test, replacing the stale
#52 pin that expected toddler to top out at 2).

| Domain | toddler | preschool | primary | teen | young_adult |
|---|---|---|---|---|---|
| repetitive_behaviour | 3 ✅ | 3 ✅ | 3 ✅ | 3 ✅ | 3 ✅ |

Every band/domain pair tracked in `content-gaps.md` §10's "Current state" table now reads
✅ or a scope-question `—`. Adding T24 to the toddler bank also shifted the questionnaire's
"halfway encouragement" midpoint by one question (T6 → T7 for a toddler path); updated
`apps/mobile/src/screens/Questionnaire/QuestionnaireScreen.test.tsx` accordingly, same
maintenance issue #79 already hit when it added T22/T23.

One integration fixture (`apps/backend/test/screening.integration.spec.ts`, the issue #52
sparse-domain regression test) previously answered only T10+T11 to fully answer the
toddler band's repetitive_behaviour questions; it now also answers T24, and since 3/3
answers means full completeness for the domain, confidence there correctly moves from
`low` to `medium` — the intended effect of closing the coverage gap, not a regression.

## For the advisor

- Question wording, option list, and hints (newly authored; constructs align with
  RBQ/AQ restricted-interests and repetitive-movement items, wording not copied).
- Whether T24's "restricted/intense interest" framing is distinct enough from T10's
  chip-select "lining up toys" option, or whether they overlap.
- Whether YA16 should be a separate item from YA5 (intense interests), given both sit
  under "repetitive_behaviour" — TE13 already sets this precedent for teen.
- Placeholder weight values, as with all weights.
