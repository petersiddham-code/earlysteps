# 2026-07-10 — Learning coverage: young_adult (issue #92)

**Content version:** questions young_adult 1.8.0 / weights 0.11.0-placeholder
**Status:** ⛔ awaiting advisor sign-off

## What issue #92 found

Learning was fully closed for toddler (intentionally, per #83) but young_adult asked zero
learning questions — the domain wasn't asked at all in that band (`—` in the coverage
matrix). Issue #83 asked the advisor to resolve whether each `—` cell was a developmentally
intentional omission or an unaddressed gap; learning (young_adult) was confirmed a real gap,
filed as this issue. Unlike the pre-existing thin `•` cells in preschool/primary/teen
(1 item each, a separate open gap — content-gaps.md §10), this is net-new domain coverage:
young_adult needed the full 3-item floor authored from scratch.

## What changed

Three newly authored questions (YA20, YA21, YA22), grounded in adaptive/learning-style
constructs appropriate for an adult screening context — kept inside the product plan's
autism-screening scope, not drifting into a general educational or cognitive assessment:

- **YA20** — need for structure: whether [child] works or studies best with a clear,
  predictable structure and finds it harder without one. Distinct from YA6 (reaction to
  routine changes in daily life generally, `repetitive_behaviour` domain) by scoping
  specifically to work/study settings.
- **YA21** — response to a change in instruction or task format: how [child] handles a
  teacher, manager, or course suddenly changing how something is explained or the shape of
  a task. Worded around the *format* of instruction changing, not the task getting harder,
  to stay a distinct construct from YA6 and from the attention-shifting item (YA18).
- **YA22** — attention to detail in learning: whether [child] tends to focus closely on
  getting details exactly right, sometimes more than the overall goal, when learning
  something new. Grounded in the AQ attention-to-detail subscale; framed as a possible
  strength in the hint, consistent with CLAUDE.md §2 rule 6.

Wording is our own; no licensed instrument text copied. All three follow the standing
question schema (buttons, `not_sure` option, a `hint`).

**Placeholder weights** added for all three (`max` combine, same value pattern as the rest
of the young_adult bank: the highest-concern option scores 10, the middle option scores 5)
— same NOT-CLINICALLY-VALIDATED status as every other weight in `domain-weights.json`.

## Result

Learning now reaches the 3-item evidence floor in young_adult (pinned in
`packages/content/src/questionTotals.test.ts`, "pins issue #92" test). This closes the last
`—` scope-question cell raised by issue #83.

| Domain | young_adult |
|---|---|
| learning | 3 ✅ |

## For the advisor

- Question wording, option lists, and hints (newly authored; constructs grounded in
  adaptive/learning-style items used in adult screening contexts, wording not copied).
- Whether YA20/YA21 read as clearly distinct constructs from YA6 (routine-change reaction)
  and YA18 (attention-shifting) as intended, or overlap too closely in practice.
- Whether the attention-to-detail framing (YA22) is clinically apt for this domain, or
  reads too close to a general cognitive-style assessment rather than an autism-screening
  signal.
- Placeholder weight values, as with all weights.

The pre-existing thin `•` cells for learning (preschool/primary/teen, 1 item each) and
daily_living (primary/teen/young_adult) remain open, unaddressed gaps — out of scope for
#92, tracked in `content-gaps.md` §10.
