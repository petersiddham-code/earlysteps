# 2026-07-02 — Age band derived from birth month+year; optional inclusive gender field

**Status: ⛔ awaiting advisor sign-off**

Issue #25. No question wording, weights, thresholds, or result copy changed — the clinical
content here is (a) the **age-band boundary definitions** now encoded in code, and (b) the
**wording of the new gender field** in Child Profile Setup.

## What changed

1. "Tell us about your child" no longer asks the caregiver to pick an age range manually.
   It captures **birth month + year** (deliberately not the full date — month granularity
   is enough for every band boundary while storing less identifying data) and the age band
   is **derived automatically**, at read time, on the backend. A child can age into the
   next band between sessions and the questionnaire then serves the new band's questions.
   Each computed screening snapshot records which band it used, so trend history stays
   interpretable.
2. A new **optional gender field**: Girl / Boy / Prefer to self-describe / Prefer not to
   say, with an optional free-text box for self-describe. Tapping a selected option again
   deselects it — it is never a forced or one-way choice.

## Age-band boundaries (clinical content — please confirm)

Month-granular, inclusive ranges mapped from the existing caregiver-facing labels
(`packages/shared-types/src/ageBand.ts`, boundary-tested from both sides):

| Band | Months | Meaning |
|---|---|---|
| toddler | 12–36 | first birthday through the 3rd-birthday month |
| preschool | 37–71 | 3–5 years, until the 6th-birthday month |
| primary | 72–155 | 6–12 years, until the 13th-birthday month |
| teen | 156–227 | 13–18 years, until the 19th-birthday month |
| young_adult | 228–311 | 19–25 years, until the 26th-birthday month |

Decisions embedded there:

- **Exactly 36 months resolves to toddler** (the "Toddler (12–36 months)" label wins over
  "Preschool (3–5 years)" at the overlapping edge).
- **Out of range at creation** (under 12 months / over 25 years) is rejected with:
  *"Our check-ins are designed for ages 12 months to 25 years. Please check the birth
  month and year."*
- **Out of range at read time** (a child who ages past 25 between sessions) clamps to the
  nearest band (young_adult) so the app keeps working rather than erroring; creation-time
  validation stays strict.

## Gender field (clinical content — please confirm wording)

- Label: *"Their gender (optional)"* — hint: *"Skip this if you'd rather — it's entirely
  up to you."*
- Options: *Girl / Boy / Prefer to self-describe / Prefer not to say*; self-describe opens
  an optional box: *"In your own words (optional)"*.
- **Stored only.** Nothing in scoring, phrasing, red flags, or question selection reads it.
  Any future use (e.g. accounting for under-identified presentations in girls) is a
  scoring/interpretation decision that requires separate advisor sign-off BEFORE it
  influences anything (CLAUDE.md §9) — this note only covers capturing it.
- A self-description is only persisted alongside "prefer to self-describe"; a stray detail
  with any other option is dropped (data minimization).

## For the advisor to confirm

1. Are the month boundaries above the intended reading of the band labels (especially
   36 months → toddler)?
2. Is the supported range (12 months–25 years) with the stated rejection message
   acceptable, including the suggestion to check back after the first birthday being
   omitted (we kept the message short)?
3. Gender wording: labels, hint, and the self-describe free-text approach.
