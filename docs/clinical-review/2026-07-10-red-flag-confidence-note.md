# 2026-07-10 — Red-flag confidence note on Results (issue #70)

**Content version:** result-copy 1.3.0 (one new field, no existing wording changed)
**Status:** ⛔ awaiting advisor sign-off (same open question as
`2026-07-09-recommendation-confidence.md`, which this builds on)

## What issue #70 found

QA on PR #69 (issue #65) noticed that the Results screen can show a domain at **low
confidence** while the overall recommendation right below it reads **high confidence**.
That's by design — `deriveRecommendationConfidence` in
`packages/scoring-engine/src/recommendationTier.ts` reports `high` whenever a red flag
fired, regardless of how sparse the rest of the intake is, because a red flag is a direct
rule match on one explicit answer, not a weighted average (CLAUDE.md §2 rule 8: a red flag
can never be diluted by thin domain evidence). To a caregiver reading the screen, though,
two different confidence numbers in the same view read as the app contradicting itself.

The issue asked whether this is clinically correct as-is, or whether the screen needs
copy/UI treatment "explaining that the high confidence comes from the red flag itself, not
from the domain score" — explicitly flagging that decision as needing advisor input, not
an engineering call.

## What this PR does (and doesn't do)

It does not change the confidence heuristic itself — that judgment call is still open,
tracked in `2026-07-09-recommendation-confidence.md`. What it adds is a short explanatory
line, shown only in the one case that can read as contradictory:

- New `red_flag_confidence_note` field in `packages/content/result-copy/labels.json`
  (schema in `packages/content/src/schema.ts`), a single sentence: *"This confidence comes
  from a clear, direct answer you gave — not from the area scores above, which is why the
  two can look different on this screen."*
- Rendered on `ResultsScreen` immediately below the recommendation confidence line,
  gated on `results.redFlagTypes.length > 0` — the exact condition under which
  `recommendationConfidence` is red-flag-forced rather than borrowed from the support
  estimate. When there's no red flag, `recommendationConfidence` already equals the
  support estimate's own confidence, so there's nothing to reconcile and the note doesn't
  show.

No existing label, tier, support term, or disclaimer wording changed. No scoring weight,
threshold, or red-flag trigger changed.

## Why this framing, not the alternatives

The issue named two directions: confirm the current behavior is fine as-is, or add
copy/UI to explain it. A silent no-op felt wrong given QA explicitly flagged it as reading
as a contradiction; a wording change to the confidence heuristic itself would be a bigger,
separate clinical call (already tracked and unresolved in `2026-07-09-...md`). Adding a
short explanation is the smallest change that resolves the "looks contradictory" complaint
without pre-empting the advisor's answer on the heuristic itself — if the advisor instead
wants the heuristic changed, this note is simply removed or reworded alongside that change.

## What advisor sign-off should confirm

1. Whether this explanation is the right caregiver-facing framing at all, versus (e.g.)
   dropping the word "confidence" entirely for flag-driven tiers, as the prior note
   already raised.
2. If it is the right framing, whether this exact wording holds up — no banned words are
   used, but tone/clarity for a low-literacy caregiver audience is a judgment call this
   note is explicitly not qualified to make on its own.
