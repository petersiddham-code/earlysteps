# Clinical content review

Anything touching **question wording, activity instructions, scoring weights/thresholds,
red-flag trigger definitions, or result/report copy templates** is *clinical content*, not
just code (CLAUDE.md §9, product plan §13). Before merging such a change to a release branch:

1. Add a note in this directory: what changed, why, and the reviewing advisor.
2. Flag the PR as **"clinical content change — needs advisor sign-off."**
3. Do not merge without the sign-off recorded here — even for a seemingly small wording tweak
   (e.g., "abnormal" → "different" is exactly why this gate exists).

Pure engineering changes (refactors, infra, non-content bug fixes) do not need this gate.

## Sign-off log

| Date | Content version | What changed | Advisor | Status |
|---|---|---|---|---|
| — | questions 1.0.0 / weights 0.1.0-placeholder | Initial foundation scaffold: Toddler + Preschool + Universal question banks (extracted verbatim from product plan §4.1c), placeholder scoring weights. | _pending_ | ⛔ NOT signed off — see content-gaps.md |
| 2026-07-02 | scoring engine (no weight/threshold/wording changes) | Uncertainty answers ("not sure"/"prefer not to say") excluded from scoring and confidence; repeated answers deduped, latest wins — see `2026-07-02-uncertainty-answers-and-dedupe.md`. | _pending_ | ⛔ awaiting sign-off |
| 2026-07-02 | questions 1.0.0 (primary, teen, young-adult) / weights 0.1.0-placeholder | Primary + Teen banks extracted from product plan §4.1c D–E (hints authored where spec had none); NEW Young Adult 19–25 bank authored beyond spec scope; placeholder weights for all three — see `2026-07-02-age-band-expansion.md`. | _pending_ | ⛔ awaiting sign-off — Young Adult especially |
| 2026-07-02 | questions 1.0.0 (all banks) | `allow_free_text: true` enabled on six sensory-reaction questions (T12, T13, P15, PR10, TE6, YA7) — no wording/option/weight changes; optional "add anything else" box now rendered in-app — see `2026-07-02-free-text-on-sensory-questions.md`. | _pending_ | ⛔ awaiting sign-off |
