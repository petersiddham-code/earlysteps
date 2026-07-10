# 2026-07-10 — Attention coverage: teen/young_adult (issue #91)

**Content version:** questions teen 1.7.0 / young_adult 1.7.0 / weights 0.10.0-placeholder
**Status:** ⛔ awaiting advisor sign-off

## What issue #91 found

Attention was fully closed for toddler/preschool/primary by issue #79, but teen and
young_adult asked zero attention questions — the domain wasn't asked at all in either
band (`—` in the coverage matrix). Issue #83 asked the advisor to resolve whether each
`—` cell was a developmentally intentional omission or an unaddressed gap; attention
(teen, young_adult) was confirmed a real gap, filed as this issue. Unlike #79 (a top-up
from 1 item to 3), this is net-new domain coverage — teen and young_adult each needed the
full 3-item floor authored from scratch.

## What changed

Three newly authored questions per band (teen, young_adult — 6 total), grounded in
SCQ/ADOS attention constructs, kept inside the product plan's autism-screening scope
(attention-shifting/joint attention/sustained attention, not general ADHD screening).
Wording is our own; no licensed instrument text copied. The three constructs mirror the
toddler/preschool/primary attention set (T16+T22+T23 / P17+P23+P24 / PR11+PR20+PR21) so the
domain reads consistently across bands, adapted to teen/young-adult register (phone/media
sharing instead of toys, masking-aware hints per the TE13 precedent):

- **TE18 / YA17** — sustained attention: how long the child can stay absorbed in a
  self-chosen activity or topic. Mirrors the pre-existing T16/P17/PR11 construct, which
  had no teen/young_adult equivalent before this issue.
- **TE19 / YA18** — attention-shifting: how easily the child switches focus when asked,
  away from something absorbing. Mirrors T22/P23/PR20; worded around switching activities,
  not name-calling, to stay distinct from the existing `no_name_response` red-flag
  question. Masking-aware hint — older teens/young adults often hold it together when
  asked to switch in front of others and only show the frustration afterward, in private.
- **TE20 / YA19** — joint attention (initiating): the child showing or sending something
  they find interesting, unprompted, wanting the caregiver to see it too. Mirrors
  T23/P24/PR21's showing/pointing construct, adapted to how teens and young adults
  actually share interest (sending a video or article) rather than physically bringing an
  object.

**Placeholder weights** added for all six (`max` combine, same value pattern as the
toddler/preschool/primary attention set: the "very hard" / "rarely" end of the scale scores
10, the middle option scores 5) — same NOT-CLINICALLY-VALIDATED status as every other
weight in `domain-weights.json`.

## Result

Attention now reaches the 3-item evidence floor in every band (pinned in
`packages/content/src/questionTotals.test.ts`, "pins issue #91" test).

| Domain | toddler | preschool | primary | teen | young_adult |
|---|---|---|---|---|---|
| attention | 3 ✅ | 3 ✅ | 3 ✅ | 3 ✅ | 3 ✅ |

## For the advisor

- Question wording, option lists, and hints (newly authored; constructs align with
  SCQ/ADOS attention-shifting, joint-attention, and sustained-attention items, wording not
  copied).
- Whether the phone/media-sharing framing for joint attention (TE20/YA19) reads as a
  reasonable age-adapted equivalent of the younger bands' showing/pointing item, or misses
  the construct.
- Whether the masking-aware framing on TE19/YA18 (switching cost shown in private, not in
  front of others) is clinically apt for this construct, the way it already is for TE13's
  repetitive-movement item and TE15/TE16/YA13/YA14's sensory-recovery items.
- Placeholder weight values, as with all weights.
