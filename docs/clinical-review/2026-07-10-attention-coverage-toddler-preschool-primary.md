# 2026-07-10 — Attention coverage: toddler/preschool/primary (issue #79)

**Content version:** questions toddler 1.3.0 / preschool 1.5.0 / primary 1.5.0 / weights
0.6.0-placeholder
**Status:** ⛔ awaiting advisor sign-off

## What issue #79 found

Attention was the next-highest-priority gap in the per-band coverage matrix
(`content-gaps.md` §10 / `2026-07-08-per-band-evidence-totals.md`, updated by #78): every
band that asks about attention at all (toddler, preschool, primary) had exactly 1 scored
item, below the 3-item evidence floor from issue #52. Teen and young_adult ask no attention
question at all (`—`) — that's a separate scope question (content-gaps.md §10, item 6) and
is deliberately out of scope here.

## What changed

Two newly authored questions per band (toddler, preschool, primary — 6 total), grounded in
SCQ/ADOS attention-shifting and joint-attention constructs, kept inside the product plan's
autism-screening scope (attention-shifting/joint attention, not general ADHD screening).
Wording is our own; no licensed instrument text copied.

The existing item in each band (T16/P17/PR11) covers sustained attention to a preferred
activity. The two new items cover different constructs so all three are complementary
rather than redundant:

- **T22 / P23 / PR20** — attention-shifting: how easily the child can be redirected or
  switch focus from one activity to another. Deliberately worded around redirecting from an
  absorbing activity, not around calling the child's name, to stay distinct from the
  existing `no_name_response` red-flag question (T4/P5).
- **T23 / P24 / PR21** — joint attention (initiating): the child bringing, showing, or
  pointing out something to share interest with a caregiver, unprompted. This is the
  child-*initiating* direction; it's deliberately distinct from T17 (preschool/primary have
  no direct equivalent), which asks whether the child *responds* to an adult's point —
  initiating and responding are different constructs in the ADOS/SCQ literature and worth
  keeping separate rather than merging into one item.

**Placeholder weights** added for all six (`max` combine, mirroring the existing T16/T17
pattern: the "very hard" / "rarely" end of the scale scores 10, the middle option scores 5)
— same NOT-CLINICALLY-VALIDATED status as every other weight in `domain-weights.json`.

## Result

Attention now reaches the 3-item evidence floor in toddler, preschool, and primary
(pinned in `packages/content/src/questionTotals.test.ts`, "pins issue #79" test).

| Domain | toddler | preschool | primary | teen | young_adult |
|---|---|---|---|---|---|
| attention | 3 ✅ | 3 ✅ | 3 ✅ | — | — |

## For the advisor

- Question wording, option lists, and hints (newly authored; constructs align with
  SCQ/ADOS attention-shifting and joint-attention items, wording not copied).
- Whether splitting "attention-shifting" and "joint attention (initiating)" into two
  separate items per band is the right granularity, versus combining them or picking
  different constructs.
- Placeholder weight values, as with all weights.
- The teen/young_adult scope question (should attention be asked there at all) remains
  open — tracked separately in `content-gaps.md` §10, item 6.
