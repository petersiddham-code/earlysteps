# Issue #112 — Section A heading on Results

**Date:** 2026-07-13
**Issue:** #112 (UI polish pass)
**Content changed:** `result-copy` 1.3.1 → 1.4.0 (one new field: `card_heading`)

## What changed

Section A on the Results screen (the deterministic screening engine's output, CLAUDE.md
§14) had no visible title. Section B (`AIAssessmentCard`) and the Comparison Section
(`ComparisonCard`) each already render their own `card_heading` ("AI assessment" /
"How these compare") from their content files — Section A was the odd one out, which made
the three regions read asymmetrically and worked against §14's goal of making which section
is the official deterministic result versus an AI reflection obvious at a glance.

New field `card_heading: "Screening results"` added to
`packages/content/result-copy/labels.json`, rendered at the top of
`section-a-deterministic` in `ResultsScreen.tsx` with the same visual treatment
(icon + bold heading) the other two sections already use.

## Why this is clinical content

`result-copy` is result/report copy template content per CLAUDE.md §9 — any new field in it
goes through the same review gate as every other label in this file, even a short section
title, per the "abnormal vs different" precedent §9 itself calls out.

## What did NOT change

- No change to any of the six approved result labels, three support-level terms, or the
  disclaimer (CLAUDE.md §2 rules 2–3, 5).
- No change to scoring, weights, thresholds, or red-flag rules.
- No change to Section B or Comparison Section copy — their `card_heading` values are
  unchanged from the 2026-07-11/12 dual-assessment entries below.

## Sign-off status

PLACEHOLDER pending advisor review — see the sign-off log entry below. "Screening results"
is a plain, low-risk label (it doesn't use any of the six approved SignLevel/recommendation
strings, so there's no drift risk against CLAUDE.md §2 rules 2–3), but it's still new
caregiver-facing wording and needs the same sign-off every other card_heading in this file
got.
