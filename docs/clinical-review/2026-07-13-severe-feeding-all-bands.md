# 2026-07-13 — Severe-feeding red flag wired for every age band (issue #110)

**Content version:** questions primary 1.7.0 / teen 1.8.0 / young_adult 1.9.0,
weights 0.12.0-placeholder
**Status:** ⛔ awaiting advisor sign-off (newly authored wording + options + weights)

## What issue #110 found

Found during the issue #66 coverage audit (`2026-07-12-issue66-coverage-audit.md`).
`checkSevereFeeding()` in the scoring engine only ever looked at `T14` (toddler) and `P16`
(preschool). Primary, teen, and young-adult banks had no feeding/eating question at all, so
a caregiver reporting severe feeding/growth concern for one of those three bands had no way
to trigger the `severe_feeding` red flag — the escalation described in product plan §4.8
silently never fired outside toddler/preschool. `FU_severe_feeding` (the free-text
confirmation follow-up, issue #26) already existed for every band, which was the tell that
this was a coverage gap, not a deliberate design — the same shape of gap issue #65 fixed for
`severe_sleep`.

## What changed

One new feeding/eating question per remaining band, same shape and trigger option as
`T14`/`P16` (buttons: wide variety / somewhat picky / very picky / so few foods I worry
about their growth or health / not sure), mapped to the `sensory` domain to match
`T14`/`P16`'s existing mapping (content-gaps.md item 3):

| Band | New question id | Inserted after |
|---|---|---|
| primary | PR23 | PR19 |
| teen | TE21 | TE16 |
| young_adult | YA23 | YA14 |

`checkSevereFeeding()` now checks all five feeding-question ids (T14/P16/PR23/TE21/YA23) —
any one answered `so_few_worried_growth` triggers the flag, same as before for
toddler/preschool. Placeholder weights mirror T14/P16 exactly
(`so_few_worried_growth: 10`, `very_picky: 8`, `somewhat_picky: 4`, max-combine, `sensory`
domain) — no new weighting scheme introduced. `redFlagContentWiring.test.ts` now pins all
five ids so this can't silently regress again.

## Side effect: sensory coverage

Each new question also adds one scored `sensory` question to its band. Primary, teen, and
young_adult were each already sitting exactly at the 3-item evidence-gate floor for sensory
(closed by issue #78) — this brings all three to 4. Updated the coverage table in
`2026-07-08-per-band-evidence-totals.md` to match. Not itself a gate/floor/threshold change.

## What needs advisor sign-off

- Wording of all three new questions and their hints (newly authored, not spec-extracted —
  primary/teen/young_adult banks don't have a spec-provided feeding item to extract from).
- Whether the `sensory` mapping — already unresolved for T14/P16 per content-gaps.md item 3
  — should extend to all five bands or get a dedicated handling path instead. Still open,
  same as it was left after #65; not resolved by this PR.
- Placeholder weights (mirrors T14/P16, not independently reviewed).
