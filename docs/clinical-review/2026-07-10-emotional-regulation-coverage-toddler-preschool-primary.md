# 2026-07-10 — Emotional-regulation coverage: toddler/preschool/primary (issue #82)

**Content version:** questions toddler 1.5.0 / preschool 1.6.0 / primary 1.6.0 / weights 0.9.0-placeholder
**Status:** ⛔ awaiting advisor sign-off

## What issue #82 found

Emotional_regulation was the last remaining gap in the per-band coverage matrix
(`content-gaps.md` §10 / `2026-07-08-per-band-evidence-totals.md`): toddler and preschool
each had only 1 scored emotional_regulation item (the sleep question, T15/P21), and primary
had 2 (PR13 frustration-coping + PR17 sleep) — all below the 3-item evidence floor from
issue #52. Issue #65's sleep-question work (TE14/YA12) closed teen and young_adult as a
side effect; this closes the three residual bands.

## Domain-mapping dependency (checked, none)

`content-gaps.md` §3 has an open question on whether feeding/sleep should map to
sensory/emotional_regulation at all. The three new items authored here are independent of
that question — none of them are sleep or feeding items, so they don't need it resolved
first.

## What changed

Five newly authored questions, grounded in the same constructs already used for the
existing teen/young_adult emotional_regulation triple (TE7/TE8/TE14, YA8/YA9/YA12) —
coping with frustration, mood variability, and self-reported feeling-different — rather
than inventing new constructs. Wording is our own; no licensed instrument text copied.

- **T25** (toddler) and **P25** (preschool) — frustration/meltdown coping: how the child
  reacts when upset and whether they recover. Same construct and same option set as PR13
  (primary) and TE7/YA8 (teen/young_adult), reworded for a toddler/preschool audience.
  Inserted directly before T15/P21 so the emotional_regulation cluster reads together.
- **T26** (toddler) and **P26** (preschool) — mood lability: sudden, hard-to-predict shifts
  in mood without an obvious trigger. Distinct from T25/P25 (which is about the reaction to
  a specific frustrating event) and distinct from T11/P14 (repetitive_behaviour — distress
  at routine change). Grounded in the Emotion Regulation Checklist's lability/negativity
  subscale. Inserted immediately after T25/P25.
- **PR22** (primary) — self-reported feeling different/anxious/left out, mirroring TE8/YA9
  exactly (same options, same hint, `allow_free_text: true`) scaled down for a 6–12y/o
  whose caregiver reports what the child has said. Primary already had the
  frustration-coping construct via PR13, so this fills the third parallel construct instead
  of repeating it. Inserted directly after PR17 (sleep).

**Placeholder weights** added for all five, `needs_clinical_signoff: true` (inherited from
`domain-weights.json`'s existing top-level flag):
- T25/P25: `max` combine, `big_reactions: 10` / `upset_but_recovers: 5`, identical to
  PR13/TE7/YA8's existing weight shape.
- T26/P26: `max` combine, `often_suddenly: 10` / `sometimes: 5`, mirroring the severity-ramp
  pattern used by the sleep questions (T15 etc.).
- PR22: `max` combine, `yes: 4`, identical to TE8/YA9's existing weight.

Same NOT-CLINICALLY-VALIDATED status as every other weight in `domain-weights.json`.

## Mobile test fixture updated

Adding T25/T26 shifted the toddler questionnaire path from 36 to 38 asked questions, moving
the "halfway encouragement" midpoint from T7 (index 18) to T8 (index 19) —
`apps/mobile/src/screens/Questionnaire/QuestionnaireScreen.test.tsx` updated accordingly,
the same maintenance issue #79/#81 already hit when they added toddler questions.

## Result

Emotional_regulation now reaches the 3-item evidence floor in every band (pinned in
`packages/content/src/questionTotals.test.ts`, "pins issue #82" test).

| Domain | toddler | preschool | primary | teen | young_adult |
|---|---|---|---|---|---|
| emotional_regulation | 3 ✅ | 3 ✅ | 3 ✅ | 3 ✅ | 3 ✅ |

Every band/domain pair tracked in `content-gaps.md` §10's "Current state" table now reads
✅ or a scope-question `—` — the sparse-coverage authoring plan (batches 1–5) is complete.
Only batch 6 (the `—` scope decision) remains, and that needs advisor input before any
authoring, not more content work.

## For the advisor

- Question wording, option list, and hints (newly authored; constructs align with the
  existing teen/young_adult emotional_regulation triple, wording not copied from any
  instrument).
- Whether T26/P26's "mood lability" framing is distinct enough from T25/P25's
  frustration-reaction item, or whether they read as the same thing to a caregiver.
- Whether PR22's self-report framing is developmentally appropriate for 6–12y/olds (it
  assumes the child can articulate "feeling different" to a caregiver — TE8/YA9 assume this
  for teens/adults, but primary is younger).
- Placeholder weight values, as with all weights.
