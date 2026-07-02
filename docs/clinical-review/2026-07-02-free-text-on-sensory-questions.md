# 2026-07-02 — Optional "add anything else" free text enabled on sensory-reaction questions

**Status: ⛔ awaiting advisor sign-off**

## What changed

`allow_free_text: true` was added to six existing questions (no wording, options, hints,
weights, or thresholds changed):

| Bank | Question | Text (abridged) |
|---|---|---|
| toddler | T12 | upset / covers ears at loud sounds |
| toddler | T13 | avoids certain textures |
| preschool | P15 | strong reactions to loud sounds, bright lights, textures |
| primary | PR10 | strong reactions to sounds, lights, textures, crowded places |
| teen | TE6 | strong reactions to sounds, lights, textures, crowded places |
| young-adult | YA7 | strong reactions to sounds, lights, textures, busy places |

The schema field existed from day one (product plan §4.1b: free text "always optional,
never the primary input") and eight questions already shipped with it; the mobile app now
actually renders the box for all flagged questions.

## Why

Product-owner request while testing the intake (issue #16 follow-up): a caregiver's child
reacts strongly to *other children crying/whining* — real sensory evidence that fits none
of the closed options. Closed options alone silently discard exactly the kind of specific
observation a clinician would want.

## How the free text is handled (engineering guarantees)

- Stored inside the same `IntakeResponse.answer` array as selected option ids, namespaced
  `free_text:<caregiver words>` so it can never collide with an option id.
- **Scoring is unaffected**: the deterministic engine weights unknown entries as 0 (test:
  `scoreDomain.test.ts` "ignores namespaced free-text entries").
- **Red flags are unaffected**: rules compare exact option ids; a typed "yes" cannot trip
  a rule (test: `redFlags.test.ts` "free-text entries can never trip a rule").
- Typed-only answers (no option picked) are accepted but contribute nothing to any score;
  they are retained as evidence for future clinician reports.
- Free text on strengths questions (U9/U10, already flagged) is reflected back verbatim
  in the Results strengths list — the caregiver's own words, never rephrased.

## For the advisor to confirm

1. Are these six the right questions to invite free text on (any to add/remove)?
2. Box label wording: *"Anything else you'd like to add, in your own words? (optional)"*.
