# Content gaps — must close under clinical review before pilot

The foundation-phase scaffold surfaced gaps between the safety spec and the shipped content.
None of this is safe for real families until a qualified developmental advisor resolves it.
Nothing here was silently worked around — each item is wired but explicitly incomplete.

## 1. Scoring weights are placeholders (BLOCKER)

`packages/content/weights/domain-weights.json` carries `needs_clinical_signoff: true`. Product
plan §8 says weights are "derived from CDC/AAP milestone importance and NICE red-flag weighting"
but provides **no numbers**. The current values exist only to exercise the deterministic engine.
They must be reviewed and replaced. The bucket thresholds (0–33 / 34–66 / 67–100, product plan
§8.2) are hard-coded constants in `scoring-engine/src/buckets.ts` and likewise must not change
without sign-off.

## 2. Red-flag triggers with no source question (BLOCKER)

Product plan §4.8 lists red-flag triggers, but the Toddler/Preschool banks (§4.1c) do not
contain a question for several of them. The rules exist and are unit-tested against synthetic
inputs, but they are **inert on real intake data** until these questions are authored and added:

| Red-flag rule | Trigger (product plan §4.8) | Source question status | Placeholder id used |
|---|---|---|---|
| `checkLossOfSkills` | Loss of previously-acquired words/skills (regression) | **Missing** — no regression question in any bank | `RF_loss_of_skills` |
| `checkSelfInjuryRisk` | Signs of self-injury risk | **Missing** | `RF_self_injury` |
| `checkSuddenBehaviourChange` | Sudden significant behaviour change | **Missing** | `RF_sudden_behaviour_change` |
| `checkSafetyRisk` | Any immediate safety concern | **Missing** | `RF_safety_concern` |
| `checkNoNameResponse` | No name response after repeated attempts | Uses T4 / P5 (proxy) | — |
| `checkNoFunctionalCommunication` | No functional communication method at all | Uses T2+T3 / P1 (proxy) | — |
| `checkSevereFeeding` | Severe feeding/growth concern | Uses T14 / P16 — "very picky" is a **weak proxy** for "severe" | — |
| `checkSevereSleep` | Severe sleep disruption | Uses T15 (proxy) | — |

Action: author the four missing questions (regression, self-injury, sudden change, safety) with
advisor input, then point the rules at the real ids. Review whether "very picky" (feeding) and
the sleep option truly meet the §4.8 "severe" bar or need a dedicated follow-up.

## 3. Domain mapping of feeding & sleep

Feeding (T14/P16) and sleep (T15) don't correspond to one of the nine DomainProfile domains.
They're currently mapped to `sensory` and `emotional_regulation` respectively for domain
scoring, but primarily drive red-flag rules. Confirm this mapping is clinically acceptable or
introduce a dedicated handling path.

## 4. Deferred age bands

Primary (6–12y) and Teen (13–18y) banks from product plan §4.1c §D–E, plus the teen self-report
flow, are defined in the spec but **not yet shipped** (MVP is Toddler + Preschool, product plan
§11). No scoring weights exist for them.

## 5. Recommendation-tier crosswalk is a placeholder heuristic

`scoring-engine/src/recommendationTier.ts` (`deriveRecommendationTier`) decides which of the
three §3.2 recommendation tiers to show. The product plan is explicit that red flags must
trigger a recommendation (urgent ones → "strongly recommended soon"), but it does not specify
what a red-flag-free `SupportLevelEstimate` of `high` should map to. The current rule — `high`
support estimate alone also recommends formal assessment — is a reasonable interpretation, not
a validated clinical threshold. Needs advisor sign-off before this drives real backend results.

## 6. Family/child onboarding + consent — partially closed

`apps/backend` now has a `FamiliesModule`: `POST /families`, `GET /families/:familyId`,
`PATCH /families/:familyId/consent`, `POST /families/:familyId/children`,
`GET /families/:familyId/children/:childId`. Consent is layered (product plan §4.7) — each
scope stored/toggled independently, fail-safe default (`{}` = nothing granted).
`ScreeningService.submitIntakeResponses` now requires `data_storage` consent before persisting
anything, per CLAUDE.md §2 rule 9; an unconsented or unknown child gets a 403, never a silent
write.

Mobile is now wired end to end (Splash → Consent Center → Child Setup → Questionnaire →
Results), all against the real API — no more sample-data demo screen.

Still open:
- **No auth.** Every endpoint is unauthenticated — this mirrors the screening endpoints'
  existing (already-flagged) gap, not a new one, but it means none of this is real
  account-security yet. Anyone with a `familyId`/`childId` can read or write it.
- **Only `data_storage` consent is enforced.** `ai_analysis`, `media_capture`, and
  `professional_sharing` are stored and independently toggleable (Consent Center has something
  real to persist), but nothing currently gates on them — no LLM calls, media capture, or
  report-sharing feature exists yet to enforce them against.

## 7. Scoring engine does not dedupe repeated answers to the same question (BLOCKER for re-answering)

`scoreDomains()` (`packages/scoring-engine/src/scoreDomain.ts`) iterates every `IntakeResponse`
with no dedup by `question_id` — if the same question is answered twice across separate
submissions (e.g. a caregiver revisits the questionnaire and changes an answer), **both**
answers contribute to the domain's raw/max score, inflating the denominator and distorting the
result rather than correctly using only the latest answer. Confirmed by reading the
implementation while building `apps/mobile`'s Questionnaire screen; not yet fixed.

Mitigated in the UI for now, not fixed at the source: `SplashScreen` deliberately never routes
back to the Questionnaire once a child exists (routes straight to Results instead), so the
mobile app can't trigger this by design. But any other client (a future edit-answers feature,
a second device, direct API use) can still hit it. Needs a real fix — most likely: recompute
should dedupe `IntakeResponse[]` by `question_id`, keeping only the most recent timestamp per
question, before scoring.

## 8. Results-screen "strengths" and "needs" are not the LLM-summary narrative

Product plan §9.3 has an LLM turn raw evidence into a "top 5 strengths / top 5 support needs"
narrative — not built yet (no LLM wiring exists at all). `apps/mobile`'s `ResultsScreen`
displays something honest in the meantime, not a placeholder claim:
- **Strengths**: the caregiver's own answers to the universal strengths questions (U9/U10),
  reflected back verbatim as their selected option labels — never invented, never summarized.
- **Needs**: a plain, deterministic list of domains that scored above "Low signs observed,"
  named with the approved respectful domain vocabulary (`DOMAIN_DISPLAY_NAMES`) — not narrative
  prose, just a direct data-grounded list.

This satisfies CLAUDE.md §2 rule 6 (strengths render before/alongside needs) structurally, but
is not what §9.3 ultimately specifies. Replace once the results-summary LLM prompt (already
drafted in `src/ai/prompts/results-summary.md`) is actually wired up.
