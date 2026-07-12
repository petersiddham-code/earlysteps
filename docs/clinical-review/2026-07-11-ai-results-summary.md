# Independent AI results summary (issue #104)

**Date:** 2026-07-11
**Content changed:** `ai-results-summary/copy.json` (new file, version 1.0.0) + new
`results-summary.md` LLM prompt (rewritten for this issue, replacing the unused
DomainProfile/SupportLevelEstimate-based draft from product plan §9.3).

## What changed

Wires up product plan §9.3's "results summary" LLM use case for the first time, as a new
expandable "AI assessment" section on the Results screen. Per the issue's revised design,
the model receives **only the caregiver's raw questionnaire answers** (question text,
selected option(s), any typed note) plus age band and gender — never the deterministic
engine's computed domain levels, support estimate, recommendation tier, or red flags. This
is deliberately an *independent* second read for the caregiver to compare against the
official result, not an AI explanation of it.

New clinical content, all placeholder pending advisor sign-off:

- **Section headings** ("Overview", "Strengths", "Areas to watch", "What you mentioned")
  shown on the collapsible card.
- **Framing sentence** stating plainly that this is a separate AI read, not a second
  official finding, not to be combined with the results above.
- **`results-summary.md` prompt** — full rewrite instructing the model to: describe raw
  answers in plain language; never use any of the six approved result labels or three
  support-level terms (those are reserved for the deterministic engine, CLAUDE.md §2 rule
  7); never invent facts beyond the input; put strengths first; leave `noted_by_caregiver`
  empty if no free-text notes exist; return bare JSON.

## Why a runtime safety check, not just the static lint

The narrative is generated per-child at request time, so `scripts/lint-content.mjs` (which
only scans committed files) can never see it. Added
`containsUnsafeResultLanguage()` (`packages/shared-types/src/vocabulary.ts`) — the same
banned-word list plus the six result labels/three support terms, checked against every
string field of the model's output before it's cached or shown. Any hit (or a schema
validation failure) discards the whole narrative; the section simply doesn't render
(fail closed, CLAUDE.md §8) — there is deliberately no visible "couldn't generate this"
error state, matching how every other AI-assisted card in this app (follow-up
suggestions, domain resources) behaves when it has nothing to show.

## Gating, caching, and generation timing

- Same gate as the existing free-text analysis stage (issue #26/#76): Premium tier
  (`PremiumTierGuard` on `AnalysisController`) + `ai_analysis` consent. Free, guest, and
  consent-off sessions never call the endpoint at all.
- Cached per child (`AiResultsSummaryRecord`, one row, overwritten in place) against a hash
  of the answered-question set it was generated from — a Results visit with no new answers
  since the last generation reuses the cached narrative instead of calling the LLM again.
- Generation is kicked off as soon as the caregiver navigates to Results (same effect that
  fetches pending follow-up suggestions), not when the collapsible section is expanded —
  confirmed with the requester as an explicit correction to the issue's open question on
  this point.

## Not covered by this PR

- Exact final wording of the section headings/framing sentence — placeholder, needs
  advisor review for tone and for whether the four-section structure (vs. a different
  breakdown) is the right shape for a low-literacy caregiver audience.
- Locale/translation — English only, same placeholder-content status as the rest of the
  result-copy set.
