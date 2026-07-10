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

Related: the severe-sleep proxy was **toddler-only** until 2026-07-02 — preschool/primary/
teen/young-adult had no sleep question at all, so the flag could never fire for those bands
(issue #65). Closed 2026-07-09: one sleep question added per remaining band (P21/PR17/TE14/
YA12), `checkSevereSleep` now checks all five — see `2026-07-09-severe-sleep-all-bands.md`.
Wording/weights still await sign-off, same as the original T15 item.

## 3. Domain mapping of feeding & sleep

Feeding (T14/P16) and sleep (T15, and now P21/PR17/TE14/YA12 — issue #65) don't correspond to
one of the nine DomainProfile domains. They're currently mapped to `sensory` and
`emotional_regulation` respectively for domain scoring, but primarily drive red-flag rules.
Confirm this mapping is clinically acceptable or introduce a dedicated handling path — now a
5-band decision, not a toddler-only one.

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

Same file, same status (issue #64, 2026-07-09): `deriveRecommendationConfidence` reports
**high** confidence for any red-flag-forced tier, regardless of the rest of the intake's
evidence — see `2026-07-09-recommendation-confidence.md`. Also pending sign-off.

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
- **No auth on the families/screening endpoints.** Issue #94 added real username/password
  accounts (`AuthModule`: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`,
  bcrypt-hashed passwords, JWT sessions) — but `FamiliesController` and
  `ScreeningController` still accept any caller: anyone with a `familyId`/`childId` can read
  or write it. Still open, in order: (a) gate those endpoints behind login, (b) link a
  `User` to the `Family`/`Child` it owns (today `User` is a standalone credentials table —
  no relation to `Family` at all). CLAUDE.md's tech-stack table has been updated to record
  username/password (not the original passwordless/OTP plan) as the actual decision, made
  explicitly for this issue.
- **`data_storage` and `ai_analysis` consent are enforced; the other two are not.**
  `data_storage` gates intake persistence; since issue #26, `ai_analysis` gates the free-text
  response-analysis stage (no LLM call is ever made without it — a 403, and results still
  work). `media_capture` and `professional_sharing` remain stored and toggleable but ungated —
  no media capture or report-sharing feature exists yet to enforce them against.
- **Guest access + tier gating (issue #99), backend enforcement now closed for the AI
  endpoints (issue #76).** Three access levels exist: guest (no account — "Continue as
  guest" on Login bypasses the auth gate from issue #97/#98 and runs the questionnaire on
  the existing on-device guest pipeline from issue #63, nothing saved), free (logged in,
  `tier: 'free'`), and premium (logged in, `tier: 'premium'`, set via a self-service
  `PATCH /auth/upgrade` — there's no payment gateway in this app, so this is a deliberate
  stub, one-directional, free → premium only). Issue #99 gated AI-assisted free-text
  analysis client-side only (`canUseAiFeatures()` in
  `apps/mobile/src/session/SessionContext.tsx`): the mobile app disables the optional
  "anything else" note and skips the `response-analysis` call for a guest or free-tier
  session, but a direct API call could still reach the LLM stage on a free account with
  `ai_analysis` consent granted, since `AnalysisService` had no way to check the caller's
  tier.

  Issue #76 closed that specific gap without waiting on the broader (a)/(b) items above:
  `AnalysisController`'s three routes (`POST response-analysis`, `GET
  follow-up-suggestions`, `POST follow-up-suggestions/:id/answer`) are now gated by
  `JwtAuthGuard` + a new `PremiumTierGuard`
  (`apps/backend/src/auth/premium-tier.guard.ts`) at the controller level — an
  unauthenticated call gets 401, an authenticated free-tier call gets 403 regardless of
  `ai_analysis` consent, and `JwtStrategy` re-loads the account from the DB on every
  request so an in-session upgrade takes effect immediately, with no new token needed.
  This doesn't require the `User`↔`Family` link: the guard checks the *caller's own* tier
  from their JWT identity, not who owns the child. Verified live against a real Postgres +
  NestJS instance: no token → 401, free-tier token → 403 on all three routes even with
  `ai_analysis` granted, same token after `PATCH /auth/upgrade` → success.

  Still open, unchanged by #76: `FamiliesController` and `ScreeningController` remain
  unauthenticated ((a) above), and there's still no `User`↔`Family` ownership link ((b)
  above) — so a free/guest account's own `familyId` isn't provably *theirs*, only the tier
  check on the analysis routes is enforced. Multi-tenancy (stopping one account from
  reading/writing another's family/child data) is a separate, larger piece of work than
  this issue's scope.

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

## 10. Sparse per-band domain coverage (issue #52) — authoring plan drafted 2026-07-09

Several band/domain pairs offer fewer scored questions than the per-domain evidence floor
of 3 — full matrix in `2026-07-08-per-band-evidence-totals.md`. Worst: teen and
young_adult (most domains at 1–2 items), sensory outside toddler (1–2), attention (1
everywhere it exists). Since 2026-07-08 the gate caps its floor at the band's real
availability so these domains can surface (at low confidence) once fully answered — but
the honest remedy is authoring more questions per sparse domain per band (product-plan
requirement #5), which needs advisor input. TE13 (issue #54) added one teen repetitive
item, closing that cell; TE14/YA12 (issue #65) closed emotional_regulation for teen and
young_adult as a side effect of the sleep-question work. Issue #78 closed sensory for
preschool/primary/teen/young_adult (the priority-1 batch below) — see
`2026-07-09-sensory-coverage-preschool-primary-teen-young-adult.md`. The rest remain open.

### Current state (post #92)

| Domain | toddler | preschool | primary | teen | young_adult |
|---|---|---|---|---|---|
| social | 9 ✅ | 7 ✅ | 5 ✅ | 3 ✅ | 3 ✅ |
| communication | 4 ✅ | 6 ✅ | 3 ✅ | 3 ✅ (closed by #80) | 3 ✅ (closed by #80) |
| sensory | 4 ✅ | 3 ✅ (closed by #78) | 3 ✅ (closed by #78) | 3 ✅ (closed by #78) | 3 ✅ (closed by #78) |
| repetitive_behaviour | 3 ✅ (closed by #81) | 3 ✅ | 3 ✅ | 3 ✅ (closed by TE13) | 3 ✅ (closed by #81) |
| attention | 3 ✅ (closed by #79) | 3 ✅ (closed by #79) | 3 ✅ (closed by #79) | 3 ✅ (closed by #91) | 3 ✅ (closed by #91) |
| emotional_regulation | 3 ✅ (closed by #82) | 3 ✅ (closed by #82) | 3 ✅ (closed by #82) | 3 ✅ (closed by TE14) | 3 ✅ (closed by YA12) |
| learning | — (intentional) | **1 •** | **1 •** | **1 •** | 3 ✅ (closed by #92) |
| daily_living | — (intentional) | — (intentional) | **1 •** | **1 •** | **1 •** |

`•` = below the floor of 3. `—` = domain not asked in that band at all. Issue #83 asked the
advisor to resolve each `—` cell — is the domain developmentally inapplicable to that band,
or an unaddressed gap? Resolved 2026-07-10:
- **Attention (teen, young_adult)** — real gap, not intentional. Filed as #91 (net-new
  domain coverage, 3 items each band). **Closed by issue #91** — TE18/TE19/TE20,
  YA17/YA18/YA19, see `2026-07-10-attention-coverage-teen-young-adult.md`.
- **Learning (toddler)** — confirmed intentional (too early for a learning-style signal).
  No items to author.
- **Learning (young_adult)** — real gap, not intentional. Filed as #92 (net-new domain
  coverage, 3 items). **Closed by issue #92** — YA20/YA21/YA22, see
  `2026-07-10-learning-coverage-young-adult.md`.
- **Daily_living (toddler, preschool)** — confirmed intentional (too early for independent
  daily-living skills to be a meaningful signal). No items to author.

### Proposed authoring batches, in priority order

Grounded in the same validated-instrument constructs used for prior expansions (never
copying licensed instrument text) — M-CHAT-R, SCQ, AQ, CAT-Q, RBQ, Sensory Profile — kept
inside the product plan's autism-screening scope (e.g. attention items stay in
"attention-shifting/joint attention," not general ADHD screening). Older-band items should
be masking-aware in their hints, the precedent set by TE13.

1. ~~**Sensory** (preschool +1, primary +2, teen +2, young_adult +2 = 7 items) — sharpest
   drop-off in the matrix (toddler 4 → 1–2 everywhere else), hits 4 of 5 bands. Highest
   priority.~~ **Closed by issue #78** — P22, PR18/PR19, TE15/TE16, YA13/YA14, see
   `2026-07-09-sensory-coverage-preschool-primary-teen-young-adult.md`.
2. ~~**Attention** (toddler +2, preschool +2, primary +2 = 6 items) — thin on every band
   it's currently asked in. Now highest priority.~~ **Closed by issue #79** — T22/T23,
   P23/P24, PR20/PR21, see
   `2026-07-10-attention-coverage-toddler-preschool-primary.md`.
3. ~~**Communication** (teen +1, young_adult +1 = 2 items) — smallest lift, good quick
   win.~~ **Closed by issue #80** — TE17, YA15, see
   `2026-07-10-communication-coverage-teen-young-adult.md`.
4. ~~**Repetitive_behaviour** (toddler +1, young_adult +1 = 2 items) — residual after
   TE13.~~ **Closed by issue #81** — T24, YA16, see
   `2026-07-10-repetitive-behaviour-coverage-toddler-young-adult.md`.
5. ~~**Emotional_regulation** (toddler +2, preschool +2, primary +1 = 5 items) — residual
   after #65 closed teen/young_adult.~~ **Closed by issue #82** — T25/T26, P25/P26, PR22,
   see `2026-07-10-emotional-regulation-coverage-toddler-preschool-primary.md`.
6. ~~**Scope decision for the `—` cells** — advisor input only, no authoring until
   resolved.~~ **Resolved by issue #83** (2026-07-10): attention (teen, young_adult) and
   learning (young_adult) are real gaps, filed as #91 and #92; learning (toddler) and
   daily_living (toddler, preschool) are confirmed intentional, no authoring needed. The
   pre-existing thin cells for learning (preschool/primary/teen) and daily_living
   (primary/teen/young_adult) remain open, unaddressed gaps — out of scope for #83, still
   need their own batch.
7. ~~**Attention** (teen +3, young_adult +3 = 6 items) — net-new domain coverage per #83's
   scope resolution, not a top-up.~~ **Closed by issue #91** — TE18/TE19/TE20,
   YA17/YA18/YA19, see `2026-07-10-attention-coverage-teen-young-adult.md`.
8. ~~**Learning** (young_adult +3 = 3 items) — net-new domain coverage per #83's scope
   resolution, not a top-up.~~ **Closed by issue #92** — YA20/YA21/YA22, see
   `2026-07-10-learning-coverage-young-adult.md`. This resolves the last `—` scope-question
   cell raised by #83; the pre-existing thin `•` cells for learning
   (preschool/primary/teen) and daily_living (primary/teen/young_adult) remain open,
   unaddressed gaps needing their own batch.

### Process per batch (mirrors how #52/#54/#65 shipped)

1. Author items in the relevant band's question bank JSON; bump that bank's content
   version.
2. Add placeholder weights (`needs_clinical_signoff: true`); bump `domain-weights.json`
   version.
3. Update `packages/content/src/questionTotals.test.ts` and add a dated
   `docs/clinical-review/YYYY-MM-DD-<domain>-coverage.md` note.
4. Add a `docs/clinical-review/README.md` row, `_pending_`; flag the PR "clinical content
   change — needs advisor sign-off" (CLAUDE.md §9 — every batch here is a wording + weight
   change).
5. Refresh the matrix in `2026-07-08-per-band-evidence-totals.md` so it stays the single
   source of truth for coverage state.

## 11. Recommendation confidence only exists on the mobile Results screen (issue #64)

A PR reviewer asked whether the web results page, generated clinician reports, and the
coaching chatbot also render confidence beside every finding. Checked: none of those
surfaces are built yet — `apps/admin` is an explicit placeholder (README + package.json
only, "Not implemented in the foundation phase"), the PDF clinician-report service doesn't
exist (only the prompt spec at `src/ai/prompts/clinician-report.md`), and the coaching
chatbot is likewise prompt-only (`src/ai/prompts/coaching-chatbot.md`). `ResultsView.
recommendationConfidence` (added in #64) is the only place this data currently reaches a
caregiver, via `apps/mobile`'s Results screen. Whoever builds any of those surfaces next
must carry the same convention forward — confidence beside every finding/recommendation,
never a bare label.
