# Minimum-evidence gate: "not enough information yet" (issue #22)

**Date:** 2026-07-02
**Status:** ⛔ awaiting advisor sign-off — placeholder thresholds AND new result-state copy
**Scope:** `packages/content/thresholds/evidence-floors.json` (new),
`packages/content/result-copy/labels.json` 1.0.0 → 1.1.0,
`packages/shared-types` `INSUFFICIENT_EVIDENCE_LABEL`,
`packages/scoring-engine` `evidenceGate.ts` + `deriveRecommendationTier` (null tier),
review-step notice copy in `apps/mobile` QuestionnaireScreen.

## What changed and why

Found while testing #20: one answered question was enough to unlock the full results page —
a domain traffic light, a "moderate support needs (low confidence)" estimate, and a
recommendation tier. Caregivers read the label, not the confidence qualifier; established
screeners (M-CHAT-R etc.) emit no score until the instrument is complete.

The engine now emits a distinct **"not enough information yet"** state instead of a result
when too few scored questions were answered:

- **Per domain:** fewer than `min_scored_answers_per_domain` answered scored questions in a
  domain → no traffic light for it (the level/score stay on the stored finding for audit and
  trend history only). If the child's question set has fewer available scored questions in a
  domain than the floor, the floor drops to that total so a fully-answered sparse domain is
  not gated forever.
- **Overall:** fewer than `min_scored_answers_overall` scored answers in total → no
  support-level estimate and no recommendation tier (a null tier; even "Support activities
  can begin now" is a claim too strong for near-zero evidence).
- **Fail closed at the API:** the backend re-derives the gate from stored findings, so
  snapshots computed before this change (which carry no sufficiency markers) render as
  "not enough information yet" until the next recompute, and a pre-gate support estimate can
  never reach a caregiver.
- **Red flags are EXEMPT (CLAUDE.md §2 rule 8):** red-flag rules run unchanged against raw
  answers; one serious sign surfaces even as the only answer given, and a red flag always
  forces a recommendation tier regardless of the gate.

Also added (honesty/provenance, same issue): a "Based on N answers · last updated {date}"
line on the Results screen, and a review-step notice when fewer than the overall floor of
questions were answered ("…the next screen may not have much to share yet").

## Placeholder thresholds — advisor must set these

| Floor | Placeholder value | Rationale needed from advisor |
|---|---|---|
| `min_scored_answers_per_domain` | 3 | Aligned with the existing "confidence caps at low below 3 answers" heuristic. Note: with global banks, some domains offer few questions per age band (e.g. toddler attention has 1) — such domains will read "not enough information yet" even when fully answered until per-band floors/totals are decided. |
| `min_scored_answers_overall` | 10 | Roughly half a band's scored questions; well below M-CHAT-R's complete-instrument standard. Possibly should be per age band (teen band has only 12 scored questions). |

Values live in `packages/content/thresholds/evidence-floors.json`
(`needs_clinical_signoff: true`) — editable without a code deploy, same precedent as the
placeholder scoring weights.

## New caregiver-facing copy — advisor must approve wording

This is a NEW result-state string beyond the fixed approved list in CLAUDE.md §2 rule 2, plus
two explanation sentences and two supporting lines (all placeholder):

- Label (also added to the content-lint approved list): **"Not enough information yet"**
- Domain detail: "A few more answers about this area are needed before anything can be
  shared here."
- Overall detail: "There aren't enough answers yet to estimate support needs or suggest a
  next step. Answer more whenever you're ready — everything you've shared is saved."
- Review-step notice: "That's only a little to go on so far, so the next screen may not have
  much to share yet. You can answer more whenever you're ready."
- Provenance line format: "Based on N answers · last updated {date}"

## Known limitations recorded (not fixed here)

- The gate counts scored answers globally; the backend does not yet pass per-age-band
  question totals into the engine, so the "floor drops to the available total" relief only
  activates once band-specific totals are wired (see `hasSufficientDomainEvidence`).
- The review-step notice counts all answered questions (including unscored profile/strengths
  ones), so it can under-warn slightly — never over-warn.
- Domains with zero answers still simply don't appear on Results (pre-existing behaviour);
  the gate only relabels domains with *some but too little* evidence.
