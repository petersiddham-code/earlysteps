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
