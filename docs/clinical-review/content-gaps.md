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

## 2. ~~Red-flag triggers with no source question~~ — CLOSED (pending sign-off) 2026-07-02

The four missing questions (regression, self-injury, sudden behaviour change, safety) are now
authored in the **universal bank** with ids matching the engine's `RF_*` constants, so all
eight rules run live on every intake for every age band. The severe-feeding trigger was also
sharpened: T14/P16 gained an explicit "so few foods I worry about their growth or health"
option and `checkSevereFeeding` now triggers only on that — "very picky" no longer escalates
(it stays a weighted sensory signal). `redFlagContentWiring.test.ts` now pins every rule's
question/option ids to the shipped banks so a rule can never silently go inert again. See
`2026-07-02-question-bank-professional-alignment.md` — wording and the trigger redefinition
await advisor sign-off. Still open from this item: whether the severe-sleep proxy (T15) truly
meets the §4.8 "severe" bar.

## 3. Domain mapping of feeding & sleep

Feeding (T14/P16) and sleep (T15) don't correspond to one of the nine DomainProfile domains.
They're currently mapped to `sensory` and `emotional_regulation` respectively for domain
scoring, but primarily drive red-flag rules. Confirm this mapping is clinically acceptable or
introduce a dedicated handling path.

## 4. ~~Deferred age bands~~ — PARTIALLY CLOSED 2026-07-02

Primary (6–12y), Teen (13–18y, parent version), and a new Young Adult (19–25y) band now ship
with question banks and placeholder weights — see
`docs/clinical-review/2026-07-02-age-band-expansion.md` (awaiting sign-off; Young Adult is
**beyond the product plan's scope** and fully newly authored). Still open from this item:
- Teen self-report flow (spec TS1–TS5) and any young-adult self-report equivalent —
  deliberately deferred with the product owner's agreement (caregiver-report first).
- Observation activities (§4.2) for the new bands.
- ~~Red-flag proxy questions for the new bands~~ — closed 2026-07-02: the item-2 questions
  landed in the universal bank, so the four highest-severity red flags now run for
  primary/teen/young-adult intakes too. The remaining proxy rules (name response, functional
  communication) stay toddler/preschool-only by design — they are early-childhood signs; an
  advisor should confirm no band-appropriate equivalent is needed.

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
- **`data_storage` and `ai_analysis` consent are enforced; the other two are not.**
  `data_storage` gates intake persistence; since issue #26, `ai_analysis` gates the free-text
  response-analysis stage (no LLM call is ever made without it — a 403, and results still
  work). `media_capture` and `professional_sharing` remain stored and toggleable but ungated —
  no media capture or report-sharing feature exists yet to enforce them against.

## 7. ~~Scoring engine does not dedupe repeated answers to the same question~~ — CLOSED 2026-07-02

Fixed at the source: `recompute()` now dedupes `IntakeResponse[]` by `question_id`, keeping
only the latest-timestamped answer, before both domain scoring and red-flag evaluation
(`packages/scoring-engine/src/dedupe.ts`). Re-answering a question is now safe from any
client. See `docs/clinical-review/2026-07-02-uncertainty-answers-and-dedupe.md` for the
behaviour details awaiting advisor sign-off (including the red-flag "latest wins" semantics).

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

## 9. Free-text analysis: domain-only signals are detected but unused

The response-analysis stage (issue #26) validates LLM-extracted signals that carry a
`domain` but no recognized red-flag type — and then deliberately drops them. There is no
confirmed-answer path into weighted domain scoring yet, because that would require
clinically-authored confirmation questions with their own weights (a scoring-weights change,
which this gate exists for). Until then, only red-flag-type signals generate confirmation
follow-ups. Issue #22's minimum-evidence gate should count confirmed free-text-derived
answers toward its evidence floors when both land — coordinate there, don't duplicate.

## 10. Sparse per-band domain coverage (issue #52)

Several band/domain pairs offer fewer scored questions than the per-domain evidence floor
of 3 — full matrix in `2026-07-08-per-band-evidence-totals.md`. Worst: teen and
young_adult (most domains at 1–2 items), sensory outside toddler (1–2), attention (1
everywhere it exists). Since 2026-07-08 the gate caps its floor at the band's real
availability so these domains can surface (at low confidence) once fully answered — but
the honest remedy is authoring more questions per sparse domain per band (product-plan
requirement #5), which needs advisor input. TE13 (issue #54) added one teen repetitive
item; the rest remain open.
