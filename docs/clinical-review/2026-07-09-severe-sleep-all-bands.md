# 2026-07-09 — Severe-sleep red flag wired for every age band (issue #65)

**Content version:** questions preschool 1.2.0 / primary 1.2.0 / teen 1.3.0 / young_adult 1.2.0,
weights 0.4.0-placeholder
**Status:** ⛔ awaiting advisor sign-off (newly authored wording + options + weights)

## What issue #65 found

`checkSevereSleep()` in the scoring engine only ever looked at `T15` (toddler). The other four
banks had no sleep question at all, so a caregiver reporting severe sleep disruption for a
preschool, primary, teen, or young-adult child had no way to trigger the `severe_sleep` red
flag — the escalation + resources described in product plan §4.8 silently never fired outside
the toddler band. `FU_severe_sleep` (the free-text confirmation follow-up, issue #26) already
existed for every band, which was the tell that this was a coverage gap, not a deliberate
toddler-only design.

## What changed

One new sleep question per remaining band, same shape and trigger option as `T15`
(buttons: sleeps well / some difficulty / significant struggles / not sure), mapped to the
`emotional_regulation` domain to match T15's existing mapping (content-gaps.md item 3):

| Band | New question id | Inserted after |
|---|---|---|
| preschool | P21 | P20 |
| primary | PR17 | PR16 |
| teen | TE14 | TE12 |
| young_adult | YA12 | YA11 |

`checkSevereSleep()` now checks all five sleep-question ids (T15/P21/PR17/TE14/YA12) — any one
answered `significant_struggles` triggers the flag, same as before for toddler. Placeholder
weights mirror T15 exactly (`significant_struggles: 10`, `some_difficulty: 5`, max-combine,
`emotional_regulation` domain) — no new weighting scheme introduced.
`redFlagContentWiring.test.ts` now pins all five ids so this can't silently regress again.

## Side effect: emotional_regulation coverage

Each new question also adds one scored `emotional_regulation` question to its band, which
improves (but does not close) the sparse-coverage gap tracked in
`2026-07-08-per-band-evidence-totals.md` — teen and young_adult now reach the evidence-gate
floor of 3 for that domain (2 existing + 1 new); preschool goes from 0 to 1, primary from 1 to
2. Updated the coverage table there. Not itself a gate/floor/threshold change.

## What needs advisor sign-off

- Wording of all four new questions and their hints (newly authored, not spec-extracted —
  preschool/primary/teen banks don't have a spec-provided sleep item to extract from).
- Whether the `emotional_regulation` mapping — already unresolved for T15 per content-gaps.md
  item 3 — should extend to all five bands or get a dedicated handling path instead.
- Placeholder weights (mirrors T15, not independently reviewed).
