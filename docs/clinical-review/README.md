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
| 2026-07-02 | questions 1.1.0 (all banks) / weights 0.2.0-placeholder | Professional alignment (issue #18): four universal red-flag questions authored (loss of skills, self-injury, sudden change, safety — rules now LIVE); severe-feeding trigger redefined to explicit growth-worry option; 13 new screening-construct questions across all bands (constructs from M-CHAT-R/SCQ/AQ/CAT-Q, wording our own); placeholder weights for all new items — see `2026-07-02-question-bank-professional-alignment.md`. | _pending_ | ⛔ awaiting sign-off — red-flag wording + trigger change especially |
| 2026-07-02 | questions universal 1.2.0 | U1 (age) and U2 (family languages) flagged `collected_at: "profile_setup"` — questionnaire no longer re-asks what Child Profile Setup already captured (issue #24); no wording/option/weight changes, questions stay in the bank — see `2026-07-02-suppress-profile-setup-duplicates.md`. | _pending_ | ⛔ awaiting sign-off |
| 2026-07-02 | no bank/weight changes (profile-setup flow + band-boundary definitions) | Age band now DERIVED from birth month+year (boundaries: toddler 12–36m, preschool 37–71m, primary 72–155m, teen 156–227m, young_adult 228–311m; 36m edge → toddler); manual range picker removed; new optional inclusive gender field (Girl / Boy / Prefer to self-describe / Prefer not to say — stored only, never used in scoring without separate sign-off) — issue #25, see `2026-07-02-birth-date-derived-age-band.md`. | _pending_ | ⛔ awaiting sign-off — band boundaries + gender wording |
| 2026-07-02 | result-copy 1.1.0 / evidence-floors 0.1.0-placeholder | Minimum-evidence gate (issue #22): NEW "Not enough information yet" result state (label + detail copy + review-step notice, all placeholder wording) shown instead of domain levels / support estimate / recommendation tier below placeholder floors (3 scored answers per domain, 10 overall). Red flags exempt — always surface. See `2026-07-02-minimum-evidence-gate.md`. | _pending_ | ⛔ awaiting sign-off — thresholds + new state copy |
| 2026-07-02 | follow-ups 1.0.0 (new file) / red-flag rules extended / response-analysis prompt | Free-text response analysis (issue #26): eight newly authored confirmation follow-up questions (one per red-flag type, yes/no/not_sure, hints included); every red-flag rule now also triggers on its `FU_<type>` question answered yes; response-analysis prompt rewritten for the free-text use case — see `2026-07-02-free-text-followups.md`. | _pending_ | ⛔ awaiting sign-off — follow-up wordings + trigger extension especially |
| 2026-07-08 | red-flag-copy 1.1.0 | One-tap crisis resources (issue #50): new `urgent_resources` (default: findahelpline.com global directory) rendered as tappable links in a new CrisisSupportCard at the top of Results for self_injury_risk/safety_risk; newly authored resource label/description copy; `next_steps_heading` removed (nothing rendered under it any more); base/urgent messages unchanged — see `2026-07-08-crisis-resources.md`. | _pending_ | ⛔ awaiting sign-off — default directory choice + regional tel numbers per locale |
