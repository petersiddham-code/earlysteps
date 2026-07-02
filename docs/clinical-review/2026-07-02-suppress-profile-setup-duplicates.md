# 2026-07-02 — U1/U2 flagged `collected_at: "profile_setup"` (questionnaire no longer re-asks them)

**Status: ⛔ awaiting advisor sign-off**

## What changed

Universal bank version 1.1.0 → 1.2.0 (issue #24). Two questions gained a new metadata
flag — **no wording, options, hints, weights, or thresholds changed, and neither question
was deleted from the bank**:

| Question | Text (abridged) | Flag added |
|---|---|---|
| U1 | How old is [child]? | `collected_at: "profile_setup"` |
| U2 | What language(s) does your family mainly speak at home? | `collected_at: "profile_setup"` |

The questionnaire wizard now deliberately skips any question carrying `collected_at`,
because the caregiver already answered it during Child Profile Setup (age band and
`languages` are captured on the Child record there). Previously U2 was asked a second
time as questionnaire question 1, and U1 was only skipped by accident of shipping with an
empty options array.

## Why

Redundant questions cost goodwill with tired caregivers and lengthen an already-long path
(the toddler path drops from 34 to 33 steps; U2 was pure duplication). Making the
exclusion a content flag keeps `packages/content` the single source of truth and
self-documents why the questions exist in the bank without being asked.

## Scoring / red-flag impact: none

- U1 and U2 are `domain: "profile"` — structurally unweightable; no indicator in
  `domain-weights.json` references them (new content-validation rule now enforces that a
  `collected_at` question can never be weighted).
- No red-flag rule keys off U1 or U2.
- A second new validation rule makes "unanswerable question without a `collected_at`
  flag" a content error, so a dead prompt can no longer ship incidentally.

## For the advisor to confirm

1. Is it acceptable that family language(s) are captured once at profile setup and reused,
   rather than re-confirmed at each screening?
2. Should any other universal profile question move to profile setup the same way?
