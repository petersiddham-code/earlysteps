# Results page: child's name + actionable "not enough information yet" state (issues #41, #42)

**Date:** 2026-07-03
**Status:** ⛔ awaiting advisor sign-off — new caregiver-facing copy
**Scope:** `packages/content/result-copy/labels.json` 1.1.0 → 1.2.0 (new
`insufficient_evidence.explanation` sentence), "Answer more questions" button label and
all-answered state copy in `apps/mobile` (ResultsScreen, QuestionnaireScreen).

## What changed and why

**#41:** The Results screen never said whose results it was showing. It now opens with an
"ABOUT {NICKNAME}" eyebrow — the same pattern the questionnaire already uses. No result
wording changed; this is purely attribution.

**#42 (caregiver question: "what does that mean, and how does the app help solve it?"):**
The minimum-evidence gate (issue #22) told caregivers "a few more answers are needed" and
"answer more whenever you're ready", but the app offered **no way to do that** — the only
button on Results ("Start a new set of questions") deletes the current child's session and
starts over. Two changes:

1. **New explanation sentence** shown under "Not enough information yet":
   > "This isn't a finding about your child — it simply means there aren't enough answers
   > yet to share something reliable. We only reflect what your answers clearly show, and
   > we never guess from too little."

   Design intent: the gate label alone can read as a verdict about the child; this makes
   explicit it is a statement about answer count only. Needs advisor review alongside the
   rest of the (still-placeholder) insufficient_evidence block.

2. **"Answer more questions" button** on any gated results view, returning to the
   questionnaire for the *same* child. The questionnaire now asks **only questions that
   don't already have an answer** (an answered question is never re-asked — consistent with
   the #24 "never ask twice" principle). If nothing is left to ask, a calm state says
   "Nothing new to ask right now — you've already answered every question we have about
   {nickname} for now" instead of an empty wizard.

## Safety review notes

- The approved gate label "Not enough information yet" is unchanged and still heads the state.
- No new result labels, support-level terms, or recommendation tiers; scoring, thresholds,
  and red-flag rules untouched.
- New copy passes the banned-words lint; no diagnostic language, no claims about the child.
- Red-flag views remain exempt from the gate exactly as before; the new button additionally
  appears on gated red-flag views (more answers still help there).
