# 2026-07-09 — Sensory coverage: preschool/primary/teen/young_adult (issue #78)

**Content version:** questions preschool 1.3.0 / primary 1.3.0 / teen 1.4.0 / young_adult
1.3.0 / weights 0.5.0-placeholder
**Status:** ⛔ awaiting advisor sign-off

## What issue #78 found

Sensory was the sharpest drop-off in the per-band coverage matrix
(`content-gaps.md` §10 / `2026-07-08-per-band-evidence-totals.md`): toddler has 4 scored
sensory items, but preschool/primary/teen/young_adult had only 1–2 — all below the 3-item
evidence floor from issue #52. This is the "Sensory" batch (priority 1) from the authoring
plan drafted for #52 the same day.

## What changed

Seven newly authored questions, one new construct per pair, grounded in Dunn's Sensory
Profile quadrants (Sensation Seeking, Low Registration) that the existing bank items didn't
yet cover — the existing items were all Sensory Sensitivity (loud sounds, textures, food) or
oral/eating. Wording is our own; no licensed instrument text copied.

- **P22** (preschool) — sensation-seeking (`chip_multi_select`): spinning self, crashing/
  bumping, jumping, seeking tight squeezes. Parallels T20's toddler visual-seeking item,
  which preschool didn't have an equivalent for.
- **PR18** (primary) — same sensation-seeking construct, worded for primary age.
- **PR19** (primary) — low registration (`buttons`): reduced response to pain, cold, or
  heat. A distinct Sensory Profile quadrant from PR10's existing over-responsiveness
  cluster; deliberately scoped as sensory registration, not overlapping the self-injury-risk
  red-flag rule (different construct, different question id, no weight tie-in to red flags).
- **TE15** (teen) — masking-aware recovery-from-overload (`buttons`): needing downtime after
  a loud/bright/busy place, even if the teen seemed fine at the time. Masking-aware hint,
  the precedent set by TE13 (issue #54) and TE10.
- **TE16** (teen) — low registration, same construct as PR19, teen wording.
- **YA13** (young_adult) — masking-aware recovery-from-overload, adult wording (mirrors
  YA11's "appears fine, needs recovery time" framing).
- **YA14** (young_adult) — low registration, adult wording.

**Placeholder weights** added for all seven (sensation-seeking: `sum`, 5 per selected
option, mirroring T10/P12's pattern; low-registration and recovery-from-overload: `max`,
`yes_often: 8` / `sometimes: 4`, mirroring T20/TE10/YA11) — same NOT-CLINICALLY-VALIDATED
status as every other weight in `domain-weights.json`.

**Post-QA fix (same day, PR #84 review):** P22 and PR18 shipped without a "Not sure" chip —
every other question in the bank offers an uncertainty option (`not_sure`), but the two new
`chip_multi_select` sensation-seeking questions only had "None of these". Caregivers who
aren't sure would have had to guess between "no" and a real answer. Added `not_sure` to
both, unweighted (the scoring engine already strips uncertainty selections from multi-select
answers — no engine change needed). This is a bank-wide gap in every pre-existing
`chip_multi_select` question (T10, P12, P15, PR9, PR10, TE6, TE13, YA7 all lack a "not sure"
chip too) — out of scope here since those predate #78, but worth its own follow-up issue.

## Result

Sensory now reaches the 3-item evidence floor in every band (pinned in
`packages/content/src/questionTotals.test.ts`, "pins issue #78" test).

| Domain | toddler | preschool | primary | teen | young_adult |
|---|---|---|---|---|---|
| sensory | 4 ✅ | 3 ✅ | 3 ✅ | 3 ✅ | 3 ✅ |

## For the advisor

- Question wording, option lists, and hints (newly authored; constructs align with Dunn's
  Sensory Profile quadrants, wording NOT copied).
- Whether "low registration" (PR19/TE16/YA14) and "sensation seeking" (P22/PR18) are the
  right next constructs to prioritize, versus e.g. proprioceptive/interoceptive framing.
- Placeholder weight values, as with all weights.
- Whether PR19/TE16/YA14's "not notice pain" framing risks reading as a safety item rather
  than a sensory-registration item — worded deliberately to stay distinct from the
  self-injury-risk red flag, but worth a second look.
