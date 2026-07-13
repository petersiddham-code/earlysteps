# 2026-07-13 — Learning + daily_living coverage floor (issue #66, final batch)

**Content version:** questions preschool 1.8.0 / primary 1.9.0 / teen 1.10.0 /
young_adult 1.11.0 / weights 0.14.0-placeholder
**Status:** ⛔ awaiting advisor sign-off

## What this closes

The issue #66 coverage audit (`2026-07-12-issue66-coverage-audit.md`) found two new gaps
(motor, severe-feeding — closed by #113 and #115) but also re-confirmed two pre-existing,
already-tracked gaps in content-gaps.md §10 that batches #78–#82/#91/#92 deliberately did
not touch: **learning** sat at 1 item (below the 3-item floor) in preschool/primary/teen,
and **daily_living** sat at 1 item in primary/teen/young_adult. Both were explicitly noted
as "remain open, unaddressed gaps... still need their own batch." This is that batch — the
last one needed before #66's "all age bands pass a coverage checklist" acceptance
criterion is fully met (the other three criteria were already confirmed met by the
2026-07-12 audit).

learning (toddler) and daily_living (toddler, preschool) stay untouched — issue #83
already confirmed those as intentional omissions (too early for either construct to be a
meaningful signal at that age), not gaps.

## What changed

Twelve newly authored questions, two per thin cell, following the same
never-copy-a-licensed-instrument approach as every prior batch.

**Learning** (structure/predictability preference in a learning context, and response to
a change in how something is explained — mirrors the pair already shipped for young_adult
in YA20/YA21, extended down to the three remaining bands that needed it):

- **Preschool** (P30–P31): P30 asks whether the child does best with predictable steps
  during activities/circle time. P31 asks how the child handles an activity or
  instruction being explained differently than usual.
- **Primary** (PR27–PR28): same pair, reframed around schoolwork/homework.
- **Teen** (TE25–TE26): same pair, reframed around school/study, masking-aware framing
  not needed here since the construct itself (structure preference, response to changed
  instructions) doesn't turn on self-presentation the way social/sensory items do.

**Daily_living** (a multi-step routine completed in order without per-step reminders, and
everyday safety judgment — both distinct from the existing single item per band, which
only asks about overall independence):

- **Primary** (PR29–PR30): PR29 asks about getting through a routine like getting ready
  for school without needing reminders for each step. PR30 asks about street-crossing/
  staying-close safety awareness.
- **Teen** (TE27–TE28): same pair, reframed around a teen's own daily routine and road/
  kitchen/stranger safety.
- **Young adult** (YA27–YA28): same pair, reframed around adult responsibilities
  (work/study or self-care routines) and road/money-scam/stranger safety.

**Placeholder weights** added for all 12 (`max` combine, same two-tier pattern as every
other single-select item: highest-concern option scores 10, middle option scores 5,
reassuring option and "not sure" unweighted) — same NOT-CLINICALLY-VALIDATED status as
every other weight in `domain-weights.json`.

## Result

learning and daily_living now reach the 3-item evidence floor in every band where they're
asked (pinned in `packages/content/src/questionTotals.test.ts`, "pins issue #66 (final
coverage batch)" test).

| Domain | toddler | preschool | primary | teen | young_adult |
|---|---|---|---|---|---|
| learning | — (intentional) | 3 ✅ | 3 ✅ | 3 ✅ | 3 ✅ (closed by #92) |
| daily_living | — (intentional) | — (intentional) | 3 ✅ | 3 ✅ | 3 ✅ |

With this batch, every cell in the content-gaps.md §10 matrix is either at/above the
3-item floor or a confirmed-intentional `—`. No open, unaddressed thin cells remain.

## For the advisor

- Question wording, option lists, and hints across all 12 items (newly authored;
  learning constructs mirror the already-shipped YA20/YA21 pair, daily_living constructs
  are new — sequencing/prompting-need and safety judgment).
- Whether splitting daily_living into "routine sequencing" and "safety judgment" is the
  right two-item pair, or whether a different pair would be clinically preferable.
- Whether the safety-judgment items (PR30/TE28/YA28) read as autism-screening signal
  (adaptive/safety awareness) rather than drifting into a general safety assessment.
- Placeholder weight values, as with all weights.
