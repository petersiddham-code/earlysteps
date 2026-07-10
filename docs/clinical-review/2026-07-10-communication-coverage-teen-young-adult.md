# 2026-07-10 — Communication coverage: teen/young_adult (issue #80)

**Content version:** questions teen 1.6.0 / young_adult 1.5.0 / weights 0.7.0-placeholder
**Status:** ⛔ awaiting advisor sign-off

## What issue #80 found

Communication was the smallest remaining gap in the per-band coverage matrix
(`content-gaps.md` §10 / `2026-07-08-per-band-evidence-totals.md`): teen and young_adult
each had 2 scored communication items, one short of the 3-item evidence floor from
issue #52. Every other band/domain pair was already at or above the floor for
communication.

## What changed

One newly authored question per band (teen, young_adult — 2 total), grounded in SCQ/AQ
pragmatic-language constructs. Wording is our own; no licensed instrument text copied.

The two existing items (TE1/YA1 — general conversational comfort/style, TE11/YA2 —
understanding jokes/sarcasm/indirect hints, a receptive-pragmatics construct) don't cover
conversational reciprocity — whether an exchange goes both ways or reads as one-sided. The
new item closes that:

- **TE17** (teen) — conversational reciprocity: whether conversations go both ways
  (questions back, following what the other person says) or feel mostly one-sided, about
  the teen's own topics. Masking-aware hint (precedent set by TE10/TE13): some teens learn
  practiced questions to keep a conversation going, so the hint asks for what's genuine
  rather than polite habit.
- **YA15** (young_adult) — same construct, worded self-report-adjacent to match the rest of
  the young_adult bank (YA1's "answer this together" framing).

**Placeholder weight** added for both (`max` combine, `mostly_one_sided: 8` /
`sometimes_one_sided: 4`, mirroring TE1's existing weight pattern for this band) — same
NOT-CLINICALLY-VALIDATED status as every other weight in `domain-weights.json`.

## Result

Communication now reaches the 3-item evidence floor in every band (pinned in
`packages/content/src/questionTotals.test.ts`, "pins issue #80" test).

| Domain | toddler | preschool | primary | teen | young_adult |
|---|---|---|---|---|---|
| communication | 4 ✅ | 6 ✅ | 3 ✅ | 3 ✅ | 3 ✅ |

## For the advisor

- Question wording, option list, and hints (newly authored; construct aligns with SCQ/AQ
  reciprocal-conversation items, wording not copied).
- Whether "conversational reciprocity" is the right third construct for these bands, versus
  e.g. conversation-initiation (already partly covered by YA1's "rarely starts
  conversations" option) or turn-taking specifically.
- Placeholder weight values, as with all weights.
