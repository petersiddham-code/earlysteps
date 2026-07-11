# Dual-assessment architecture for the AI results summary (issue #104, CLAUDE.md §13/§14/§16)

**Date:** 2026-07-11
**Content changed:** `ai-results-summary/copy.json` (bumped 1.0.0 → 2.0.0), new
`comparison/copy.json` (1.0.0, new file), new `results-summary.md` LLM prompt (full
rewrite of the still-open PR #105's version).

## What changed

CLAUDE.md was updated (this same date) to require a dual-assessment architecture: Assessment
A (the deterministic scoring engine, unchanged) and Assessment B (the AI Assessment Engine)
must each produce a full, independent likelihood/confidence/reasoning read, and the app must
render a separate, deterministic Comparison Section stating agreement / partial agreement /
disagreement between them. The already-open PR #105 (issue #104) had only implemented a
narrative-only predecessor of Assessment B (`overview`/`strengths`/`areasToWatch`/
`notedByCaregiver`, no likelihood, no confidence, no comparison). This is PR 1 of a
user-approved two-PR plan (see `/Users/mamta/.claude/plans/linear-sauteeing-hare.md` for the
full plan) that closes that gap for the backend/shared-types/content layer. PR 2 (Results
screen restructure into three explicit sections + four new components) is a separate,
follow-up change.

This PR:

- Rewrites `AiResultsSummary` (Assessment B's output type) to the full CLAUDE.md §13 schema:
  `likelihood` (Very Low/Low/Moderate/High/Very High — a scale separate from Assessment A's),
  `confidence` (low/medium/high — a value separate from Assessment A's), `reasoning`,
  `developmentalProfile`, `strengths`, tiered `supportPriorities`
  (immediate/short_term/medium_term/long_term, each item with a stated reason), `uncertainty`
  (narrative) + `uncertaintyFactors` (structured), `evidenceSummary`,
  `homeRecommendations`, `schoolRecommendations`, `professionalAssessmentPriorities`.
- Adds a new package, `packages/comparison-engine`, computing the Comparison Section as a
  **third, standalone deterministic function** — not part of either engine — run after both
  have independently produced output.
- Adds a new backend endpoint, `POST /children/:childId/comparison`.
- Rewrites the `results-summary.md` prompt for the new schema, preserving the existing
  isolation (the LLM still never receives Assessment A's computed data).

## Explicit rule-7 (§2) confirmation

The LLM call's inputs are UNCHANGED from the version already in PR #105: only `ageBand`,
`gender`, and the caregiver's raw answered questions. The comparison function's inputs are
typed via TypeScript `Pick<>` (`AssessmentAComparisonInput`, `AssessmentBComparisonInput` in
`packages/comparison-engine/src/compareAssessments.ts`) to exactly the fields it may read
from each side — this makes the isolation boundary statically checkable, not just a
documented convention. Neither engine reads the other's output to decide its own fields;
the comparison is computed after both have already finished, and its output
(`ComparisonResult`) is never written back into either engine's own record.

## Professional-referral carve-out (judgment call — needs advisor confirmation)

CLAUDE.md §13 requires Assessment B to output `professionalAssessmentPriorities`, but the
existing `PROFESSIONAL_REFERRAL_TERMS` ban (added in PR #105 QA, commit 28dd6db) blocks the
word "professional"/"specialist"/"doctor"/etc. in **any** field, unconditionally — applied
literally, the new required field could never validate.

Resolution: `containsUnsafeResultLanguage` (`packages/shared-types/src/vocabulary.ts`) is
split into two composable checks — `containsBannedOrReservedLanguage` (banned words +
Assessment A's reserved result labels/tiers/terms) and `containsProfessionalReferralLanguage`
(the referral-topic ban). Every Assessment B field is checked against **both**, except
`professionalAssessmentPriorities`, which is checked only against
`containsBannedOrReservedLanguage` — so it still cannot literally reuse the deterministic
engine's own tier wording (e.g. "Formal assessment is recommended"), but it can legitimately
discuss professional evaluation, which is its entire stated purpose. Every other field keeps
the full ban, including the prompt's explicit instruction that
`professional_assessment_priorities` is the ONE field where naming a professional is
permitted.

**This carve-out's exact scope (only this one field) is a judgment call, not a spec
requirement** — needs explicit advisor confirmation, alongside sign-off on the section as a
whole.

## The six comparison-reason trigger conditions (placeholder heuristic — needs advisor sign-off)

CLAUDE.md §13 names the six disagreement reasons (`unsupported_text_evidence`,
`contradictory_responses`, `insufficient_evidence`, `missing_observations`, `low_confidence`,
`conflicting_developmental_history`) but not their trigger conditions. Assessment A has no
existing structured "why uncertain" taxonomy beyond `insufficientEvidenceOverall`/gated
domains/confidence, so `compareAssessments.ts` combines:

- Assessment A's own already-computed signals: a gated domain → `missing_observations`; a
  `low` `recommendationConfidence` or `supportLevel.confidence` → `low_confidence`.
- Assessment B's own self-reported `uncertaintyFactors` (a new structured field, populated by
  the LLM describing uncertainty **only in its own evidence** — never referencing Assessment
  A, since it was never given that data): `contradictory_responses` and
  `conflicting_developmental_history` map 1:1; `limited_free_text_evidence` maps to
  `unsupported_text_evidence`; `sparse_structured_answers` maps to `insufficient_evidence`.
  Assessment B's own `confidence: 'low'` also contributes to `low_confidence`.
- A fixed catch-all: if a band mismatch exists but none of the above explain it, the reason
  defaults to `unsupported_text_evidence` — reasoning that Assessment A never sees free text
  and Assessment B always does, so an otherwise-unexplained mismatch is presumptively
  attributable to evidence only B had access to.

**This heuristic is original engineering judgment, not a clinically validated rule set** —
same placeholder status as `packages/scoring-engine/src/recommendationTier.ts`'s existing
no-red-flag/high-support crosswalk. Needs explicit advisor review before being treated as
more than a reasonable placeholder.

## Null Assessment A tier (evidence-gated) → forced partial_agreement/insufficient_evidence

When Assessment A has no recommendation tier yet (below the overall evidence floor and no red
flag forcing one), there is nothing to genuinely agree or disagree with — so the comparison
always reports `partial_agreement` with reason `insufficient_evidence`, never `agreement` or
`disagreement`. Any of Assessment B's self-reported `contradictory_responses`/
`conflicting_developmental_history` factors are still surfaced alongside it, since they're
informative regardless of Assessment A's gate state and dropping them would be a strictly
worse read for no isolation benefit.

Note: a **red-flag-forced** tier (CLAUDE.md §2 rule 8: red flags are exempt from the evidence
gate) is NOT null even when `insufficientEvidenceOverall` is true — `ResultsView.
recommendationTier` is already null exactly in the genuine "nothing yet" state, so the
comparator uses it as-is rather than re-deriving from `insufficientEvidenceOverall`.

## Agreement-suppression rule

Whenever the two sides' risk bands actually match, `reasons` is always `[]` — even if
Assessment B self-reported an uncertainty factor that would otherwise have triggered one.
Attaching a "reason" to a case with no real disagreement would read as manufactured doubt.

## Red-flag safeguard (CLAUDE.md §2 rule 8)

Whenever Assessment A has any active red flag, the comparison `narrative` always prepends a
fixed, non-suppressible safety sentence — regardless of computed status or reasons — because
a red-flag-forced Assessment A tier can validly diverge from a free-text-derived Assessment B
likelihood, and this section must never read as softening or suppressing the flag.

## Not covered by this PR

- No real clinical content review — every new string (section headings, comparison-status/
  reason sentences, `card_heading`, `red_flag_safety_note`, the prompt itself) ships as
  placeholder copy pending advisor sign-off, same status as every other content change in
  this repo's history.
- The Results screen restructure into three explicit Section A / Section B / Comparison
  regions, and the four new components (`<AIAssessmentCard/>`, `<ComparisonCard/>`,
  `<ConfidenceBadge/>`, `<SupportPrioritiesCard/>`) — deferred to PR 2 per the approved plan.
  This PR does the minimum mobile-side compile-fix needed to keep the existing
  `AiResultsSummaryCard` building against the new type shape; it is not the redesigned UI.
- Locale/translation — English only.
- Comparison results are not cached or persisted, only recomputed per request from already-
  cached/computed inputs — flagged as a possible future optimization, not a current gap.
