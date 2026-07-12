# 2026-07-13 — Motor coverage: all five age bands (issue #113)

**Content version:** questions toddler 1.6.0 / preschool 1.7.0 / primary 1.8.0 / teen 1.9.0 /
young_adult 1.10.0 / weights 0.13.0-placeholder
**Status:** ⛔ awaiting advisor sign-off

## What issue #113 found

Motor was the only one of the nine `DomainProfile` domains with zero questions in every
age band — confirmed a real gap, not an intentional exclusion, by issue #109's scope
decision (`2026-07-13-issue109-motor-scope-decision.md`). The product plan itself lists
"motor skill development" as one of the nine screened domains (line 51), and
`domain-resources.json` (issue #71) already ships a motor support-resource entry that
nothing in the intake could reach. Unlike the `—` cells issue #83 resolved (each a single
band within an otherwise-covered domain), motor was missing across the board, so this is
net-new domain coverage in every band rather than a top-up — the same shape as #91/#92,
just spanning all five bands instead of one or two.

## What changed

Fifteen newly authored questions, three per band, following the split proposed in the
issue: one gross-motor item, one fine-motor item, one coordination/motor-planning item.
Grounded in CDC/AAP gross- and fine-motor milestones and motor-planning/coordination
constructs sometimes co-occurring with autism (product plan line 14) — wording authored
fresh, no licensed instrument text copied. Kept as developmental-motor signals, not a
general physical- or occupational-therapy assessment.

- **Toddler** (T27–T29): T27 asks about steady walking/running and managing stairs with
  support (gross motor). T28 asks about stacking blocks, turning board-book pages, or
  scribbling (fine motor). T29 asks whether the child copies a simple clap or wave
  (motor imitation/praxis — the simplest developmentally appropriate motor-planning signal
  at this age).
- **Preschool** (P27–P29): P27 asks about jumping with both feet or pedaling a tricycle
  (gross motor). P28 asks about cutting along a line with safety scissors or copying a
  simple shape (fine motor). P29 asks about bumping into things, tripping, or losing
  balance more than peers (general coordination) — phrased around specific observed
  behaviours rather than labeling the child, per CLAUDE.md §2 rule 4's spirit even though
  none of the drafted wording used a banned word outright.
- **Primary** (PR24–PR26): PR24 asks about catching a gently thrown ball or riding a bike
  (gross motor). PR25 asks whether handwriting or scissors/cutlery use is noticeably harder
  than classmates' (fine motor). PR26 asks about needing more practice than peers to learn
  a new physical sequence — a dance move, sports skill, or playground game (motor
  planning/praxis, deliberately distinct from preschool's general-clumsiness framing by
  scoping to *learning a new sequence*).
- **Teen** (TE22–TE24) and **Young adult** (YA24–YA26): mirror the same three constructs
  (sports/PE coordination, fine-motor task difficulty, learning-new-physical-skill
  practice), reworded for self-report and masking-aware per the TE13/TE18-20 precedent —
  TE22/YA24's hint explicitly names that many teens/adults push through or quietly avoid
  this rather than mention it unprompted, so the answer should reflect how it actually
  feels, not how it looks from outside.

**Placeholder weights** added for all 15 (`max` combine, same value pattern as every
other single-select item in the bank: the highest-concern option scores 10, the middle
option scores 5, the reassuring option and "not sure" are unweighted) — same
NOT-CLINICALLY-VALIDATED status as every other weight in `domain-weights.json`.

## Result

Motor now reaches the 3-item evidence floor in every band (pinned in
`packages/content/src/questionTotals.test.ts`, "pins issue #113" test), and
`domain-resources.json`'s existing motor entry is reachable for the first time — a motor
`DomainFinding` can now actually be produced.

| Domain | toddler | preschool | primary | teen | young_adult |
|---|---|---|---|---|---|
| motor | 3 ✅ | 3 ✅ | 3 ✅ | 3 ✅ | 3 ✅ |

An unrelated mobile test (`QuestionnaireScreen.test.tsx`, "shows the halfway encouragement
at the midpoint of the path") hardcodes which toddler question sits at the path's midpoint
index — adding T27–T29 shifted the toddler path from 26 to 29 questions, moving the
midpoint from T8 (index 19 of 38) to T9 (index 20 of 41). Updated the test's expected
question and comment; no product behaviour changed, purely an index recalculation.

## For the advisor

- Question wording, option lists, and hints across all 15 items (newly authored;
  constructs grounded in CDC/AAP gross/fine motor milestones and motor-planning/praxis,
  wording not copied from any licensed instrument).
- Whether the three-construct split (gross motor / fine motor / coordination-motor-planning)
  is the right one per band, or whether a different split (e.g. separating imitation/praxis
  from general coordination) would be clinically preferable.
- Whether P29's general-coordination framing ("bump into things, trip, or lose their
  balance") and PR24–26/TE22–24/YA24–26's comparative framing ("compared to peers/
  classmates/others") read appropriately, or too close to a general motor-skills
  assessment rather than an autism-screening signal.
- Whether the teen/young_adult masking-aware framing (TE22/YA24's "push through or quietly
  avoid" hint) is pitched correctly for this domain, mirroring TE13/TE18-20's precedent.
- Placeholder weight values, as with all weights.
