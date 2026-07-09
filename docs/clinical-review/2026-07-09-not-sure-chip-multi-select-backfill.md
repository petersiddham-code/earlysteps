# 2026-07-09 — "Not sure" backfill on pre-existing chip_multi_select questions (issue #85)

**Content version:** questions toddler 1.2.0 / preschool 1.4.0 / primary 1.4.0 / teen 1.5.0 /
young_adult 1.4.0 (weights unchanged — no new weight added)
**Status:** ⛔ awaiting advisor sign-off

## What issue #85 found

QA on issue #78 / PR #84 caught P22 and PR18 shipping without a "Not sure" chip, then flagged
the same gap on every `chip_multi_select` question that predates #78 (noted but left
out of scope in `2026-07-09-sensory-coverage-preschool-primary-teen-young-adult.md`). Product
plan §4.1b: "I'm not sure is always an option, never a trap" — every single-select question in
the bank already honors this, but eight `chip_multi_select` questions did not. A caregiver who
genuinely doesn't know has to either guess or pick "None of these"/"None noticed", which the
scoring engine reads as a real reassuring answer, not a gap.

The other four `chip_multi_select` questions in the bank (U7, U9, U10) were checked and are
out of scope: U7 asks the caregiver's own motivation for checking in, U9/U10 are strengths
questions — neither is a developmental-signal judgment call the way repetitive-behaviour/
sensory items are.

## What changed

Added a `not_sure` option (label "Not sure"), unweighted, to the end of each question's
`options` array — same pattern used for P22/PR18:

| id | band | domain | text |
|---|---|---|---|
| T10 | toddler | repetitive_behaviour | Repeated movements (hand-flapping, rocking, spinning...) |
| P12 | preschool | repetitive_behaviour | Repeated movement (flapping, rocking, spinning, toe-walking) |
| P15 | preschool | sensory | Strong reactions to loud sounds, bright lights, textures |
| PR9 | primary | repetitive_behaviour | Repeated movements (hand movements, rocking, fidgeting, pacing) |
| PR10 | primary | sensory | Strong reactions to sounds, lights, textures, crowded places |
| TE6 | teen | sensory | Strong reactions to sounds, lights, textures, crowded places |
| TE13 | teen | repetitive_behaviour | Repeated movements or sounds (rocking, pacing, hand/finger movements, scripting) |
| YA7 | young_adult | sensory | Strong reactions to sounds, lights, textures, busy places |

No engine change needed and no new weight added: `withoutUncertainty()` in
`packages/scoring-engine/src/scoreDomain.ts` already strips uncertainty ids out of
multi-select answers before scoring, and `validateContent.ts` already rejects a weight on an
uncertainty option id.

Question bank patch versions bumped for every affected file (toddler, preschool, primary,
teen, young_adult) — content-only change, wording/hints/weights otherwise untouched.

## For the advisor

- Whether adding "Not sure" to these eight pre-existing questions is the right closing move
  for this gap, or whether any of the eight should instead prompt a rethink of their existing
  "None of these"/"None noticed" wording now that a genuine "don't know" exists alongside it.
- Confirm U7/U9/U10 are correctly out of scope (motivation + strengths questions, not
  developmental-signal judgment calls).
