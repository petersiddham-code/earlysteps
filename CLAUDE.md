# CLAUDE.md — EarlySteps

Instructions for Claude Code when working in this repository. Read this fully before writing or modifying any code, copy, or prompts.

---

## 1. What this project is

**EarlySteps** is a mobile app that helps low-income families notice possible autism-related developmental signs early, understand their child's likely support needs, and get practical home activities — while making it unmistakably clear this is a **screening and support tool, not a diagnostic one**.

Full product spec lives at `/docs/product-plan.md` (the source document — copy it into the repo root under `docs/` before starting; treat it as the source of truth for scope, screens, data model, and question banks). If anything in this file conflicts with that document on a *product* decision, the product plan wins. If anything conflicts on a *safety/language* rule, this file wins — the rules below are stricter versions specifically for code generation.

**Primary users:** parents/caregivers, often on low-end Android devices, low bandwidth, sometimes low literacy, in regions with little or no access to paediatric developmental specialists.

**Mission (2026-07-11):** EarlySteps combines deterministic scoring with expert-style AI assessment. It must give parents and professionals meaningful, evidence-based signal while staying transparent about confidence, uncertainty, and the limits of what AI can conclude — see §13 for the full dual-assessment architecture this implies.

---

## 2. Non-negotiable rules (apply to every file you touch)

These are not style preferences. Violating them is a shipped safety bug, not a nitpick.

1. **Never generate copy, code, or logic that states or implies a diagnosis.** No string anywhere in the app may say or imply "your child is autistic," "your child has autism," "your child is not autistic," or equivalent. Grep for this before finishing any task that touches user-facing copy.
2. **Only use these result labels**, verbatim, anywhere results are shown or generated: `Low signs observed`, `Some signs observed`, `Many signs observed`, `Support activities can begin now`, `Formal assessment is recommended`, `Formal assessment strongly recommended soon`. This is Assessment A's fixed vocabulary and does not change. Assessment B (§13) uses a separate `Very Low` / `Low` / `Moderate` / `High` / `Very High` likelihood scale — never substitute one vocabulary for the other, and keep them visually distinct on screen (rule 14).
3. **Only use these support-level terms**, always paired with a confidence level (`low` / `medium` / `high`): `mild support needs`, `moderate support needs`, `high support needs`. Assessment A's vocabulary only. Assessment B (§13) reports its own confidence the same `low`/`medium`/`high` way, but it is a separate value from Assessment A's confidence — never average or merge the two.
4. **Banned words in any user-facing string:** defect, abnormal, disorder (as a label applied to the child), broken, wrong, deficient, disease, sick, cure, fix. Use instead: support needs, developmental differences, communication differences, sensory needs, learning style.
5. **Every screen that displays a result, summary, or report must render the disclaimer** (component: `<ScreeningDisclaimer />`, see §6): *"This is a screening tool, not a diagnosis. Only a qualified professional (paediatrician, psychologist, or developmental specialist) can diagnose autism."* — the product plan §3.2 wording, verbatim (that section is the single source of truth for the on-screen sentence; the shorter form in product plan §9.3 is the LLM-prompt variant, not the screen copy). Do not let a code path reach a results view without it.
6. **Strengths render before/alongside support needs, never after only.** If you build a results component and strengths aren't visible above the fold or in the first tab, that's a bug.
7. **The scoring engine (Assessment A) is deterministic and rule-based (see §7), never LLM-inferred.** No LLM call may ever invent, override, or write into Assessment A's fields — `SignLevel`, `SupportLevelEstimate`, `recommendationTier`, red flags — that boundary is unchanged. As of 2026-07-11, Assessment B (the AI Assessment Engine, §8/§13) is a second, fully independent read: it forms its own likelihood and confidence from evidence Assessment A can't use (free text, notes, and future multimodal input — §15), and it renders *alongside* Assessment A, never blended into it (rule 14). If you're tempted to have Assessment A's code read anything Assessment B produced, or vice versa, stop — that breaks both halves of this rule.
8. **Red-flag rules are hard-coded and evaluated independently of the general domain scoring**, so one serious sign can never get averaged away. See `docs/product-plan.md §8` for the trigger list (loss of previously-acquired skills, no name-response after repeated attempts, no functional communication, self-injury risk indicators, severe feeding/sleep disruption, sudden behaviour change, safety risk). Assessment B (§13) may corroborate a red-flag pattern in its own narrative, but it can never soften, suppress, or override a red flag Assessment A has raised.
9. **All child-identifying media (audio/video/photos) is opt-in per instance, encrypted, and time-boxed.** Never add a code path that captures or stores media without an explicit, freshly-given consent flag for that specific capture.
10. **No analytics/telemetry event may include raw question answers, scores, reports, free text, or media.** Only anonymized, aggregate usage events (e.g., "intake_started") are permitted. If you're adding an analytics call, check it against this rule before committing. This applies equally to Assessment A and Assessment B output (§13).
11. **No third-party ad SDKs, no data broker integrations, no selling/sharing user data.** Don't add dependencies that do this even for a "just in case" growth feature.
12. **Every LLM system prompt used in this app must include the shared guardrail block** from `docs/product-plan.md §9` (or `src/ai/prompts/_guardrails.md` once scaffolded). Never call the model for user-facing analysis/copy without it.
13. **Assessment B must never simply replay the caregiver's answers back at them.** It must synthesize evidence into a developmental pattern, explain *why* and *how confident*, and name uncertainty — see the Guiding Principle and bad/good examples in §13. A results narrative that just restates "child has poor eye contact" or "child flaps hands" is a bug, not a style issue.
14. **The Results screen must always render Assessment A and Assessment B as visually separate sections, plus a Comparison section stating agreement / partial agreement / disagreement.** Never silently merge, average, or reconcile the two into one number or label — see §14. If disagreement exists, the screen must say why (unsupported text evidence, contradictory responses, insufficient evidence, missing observations, low confidence, or conflicting developmental history — §13).
15. **Strengths render before/alongside support-need content in Assessment B too**, not just Assessment A (extends rule 6). Assessment B's `strengths` field is populated before its support-priorities narrative is generated or displayed.
16. **Any change to Assessment B's likelihood/confidence output, the comparison logic, or which engine owns which field is an architecture change** — it needs the same review discipline as §9 (clinical content gate), plus explicit confirmation that rule 7's "neither engine modifies the other" boundary still holds. Note it in `docs/clinical-review/` like any other clinical content change.

If a task seems to require breaking any of these, stop and flag it back to the user rather than working around it.

---

## 3. Tech stack

| Layer | Choice |
|---|---|
| Mobile | React Native + Expo (TypeScript) |
| Backend | Node.js + NestJS (TypeScript) |
| Database | PostgreSQL (via Prisma or TypeORM — pick one and stay consistent) |
| Object storage | S3-compatible, encrypted, for opt-in media only |
| AI | Claude API (`claude-sonnet-4-6` unless told otherwise) for language generation; deterministic scoring engine is plain TypeScript, not an LLM call |
| Speech-to-text | On-device (quantized Whisper) with cloud fallback, offline-first |
| Offline storage | SQLite on-device + background sync queue |
| Auth | Username/password (bcrypt-hashed, JWT session) — revised from the original passwordless plan in issue #94, to unblock login-gated premium-tier features; see `docs/clinical-review/content-gaps.md` §6 |
| PDF generation | Server-side templating service for clinician-facing reports |

Don't introduce a different framework/library for something already covered here without asking first — consistency matters more than marginal technical preference in a small team project like this.

---

## 4. Repository structure (target — scaffold this if it doesn't exist)

```
/apps
  /mobile              # React Native (Expo) app
  /backend             # NestJS API
  /admin               # Web admin dashboard (content team: question banks, activities, translations, red-flag rules)
/packages
  /shared-types        # Shared TypeScript types (DomainProfile, IntakeResponse, etc. — mirror docs/product-plan.md §7)
  /scoring-engine       # Deterministic scoring logic — see §7 below, framework-agnostic, heavily unit-tested
  /content              # Question banks, activity library, support-plan templates as structured JSON/YAML, versioned and localized
/docs
  product-plan.md       # source-of-truth product spec
  clinical-review/      # sign-off notes per content version (see §9)
/src/ai/prompts         # LLM system prompt templates, one file per use case, + _guardrails.md shared block
```

Keep `packages/scoring-engine` and `packages/content` free of any framework-specific code — they should be testable in isolation and reusable by both mobile and backend.

---

## 5. Content is data, not hardcoded strings

Question banks (from `docs/product-plan.md §4.1c`), activity libraries, support-plan templates, and result copy templates live in `packages/content` as structured, versioned JSON/YAML — **not** inline in component files. This is deliberate:

- Non-engineers (clinical advisors, translators) need to edit this without a code deploy.
- Every content change needs a review trail (see §9) — that's much easier against versioned data files than scattered strings.
- Localization requires content to be structured per-locale from day one, not retrofitted.

When scaffolding a question or activity, follow the schema implied in `docs/product-plan.md §4.1b–4.1c`: `{ id, domain, age_band, text, type, options[], hint, follow_up? }`. Every question needs a `hint` field — don't ship one without it.

---

## 6. Key shared components (build these early, reuse everywhere)

**Already built (Assessment A / shared):**

- `<ScreeningDisclaimer />` — the fixed disclaimer sentence (§2 rule 5). Pull the exact text from `docs/product-plan.md §3.2`, don't paraphrase it. This is the component that fulfils the "AssessmentDisclaimer" role described in §13 — do not add a second, differently-named disclaimer component; reuse this one everywhere Assessment B or the comparison section also needs the disclaimer.
- `<TrafficLightBar domain confidence level />` — never a raw numeric score shown to a parent.
- `<StrengthsFirstList />` — enforces strengths-before-needs ordering at the component level so it can't be reordered by accident downstream. Assessment B's strengths (rule 15) may reuse this or need a variant — decide at build time based on its data shape.
- `<RedFlagBanner />` — calm, non-alarmist styling per `docs/product-plan.md §8` tone guidance; this is not the same visual treatment as an error state.
- `<ConsentToggle scope="data_storage | ai_analysis | media_capture | professional_sharing" />` — layered consent, each togglable independently, per `docs/product-plan.md §4.7`.

**Not yet built — required by §13/§14, tracked in §16:**

- `<AIAssessmentCard />` — renders Assessment B's likelihood, confidence, reasoning, developmental profile, strengths, and support priorities (§13).
- `<ComparisonCard />` — renders agreement / partial agreement / disagreement between Assessment A and B, with the specific disagreement reasons required in §13/rule 14.
- `<ConfidenceBadge />` — small reusable badge pairing a likelihood/level with its confidence; today confidence is rendered inline inside `<TrafficLightBar />` — extract this once Assessment B ships so both engines render confidence identically.
- `<SupportPrioritiesCard />` — renders Assessment B's Immediate / Short-term / Medium-term / Long-term recommendations (§13), each with a stated reason.

Do not assume any of the four "not yet built" components exist in the codebase — check before importing.

---

## 7. Scoring engine rules (Assessment A)

This is Assessment A per §13. Every rule below is unchanged by the 2026-07-11 dual-assessment update — if anything, Assessment A's exclusive authority over its own fields is reinforced by rules 7/14 in §2.

- Lives in `packages/scoring-engine`, pure TypeScript, zero UI/network dependencies, 100% unit-test coverage on the weighting logic.
- Input: structured `IntakeResponse[]` and `ActivityResult[]`. Output: `DomainProfile` (per domain: level + confidence + evidence refs) and `SupportLevelEstimate` (level + confidence).
- Domain score buckets: 0–33 → `Low signs observed`, 34–66 → `Some signs observed`, 67–100 → `Many signs observed`. Don't change these thresholds without an explicit clinical-review sign-off noted in `docs/clinical-review/`.
- Confidence is computed separately from score (completeness + corroboration + consistency) — never let a high score imply high confidence by default.
- Red-flag checks run as an independent rule set against raw responses, not against the aggregated domain score. Write these as small, named, individually testable functions (e.g., `checkLossOfSkills()`, `checkNoNameResponse()`) so each can be reviewed and adjusted in isolation.
- Recompute on every new data point; never mutate/overwrite prior computed profiles — keep history for trend graphs and clinician reports.

---

## 8. Working with LLM calls in this codebase

- Every prompt template lives in `src/ai/prompts/`, one file per use case (questionnaire generation, response analysis, results summary, support-plan generation, progress comparison, coaching chatbot, clinician report — see `docs/product-plan.md §9` for the seven templates).
- Every prompt file must import/prepend the shared guardrail block — don't duplicate it inline per file; keep one source of truth in `_guardrails.md` (or a constant, if you prefer code over markdown) and reference it everywhere.
- LLM output that's meant to be structured (JSON) must be validated against a schema before being used — don't trust the model to always return clean JSON; parse defensively and fail closed (show a generic "we couldn't generate this right now" state) rather than showing malformed or unvalidated content to a parent.
- Never feed the model raw PII beyond what's needed for the specific task (e.g., don't pass full family profile into a prompt that only needs one child's DomainProfile).
- The coaching chatbot (§9.6 in the product plan) must refuse diagnostic questions with the specified redirect, not attempt to answer them "carefully."
- The **results-summary** template (product plan §9.3) is Assessment B, the independent AI Assessment Engine — see §13 for its full required analytical scope, output schema, and the comparison-with-Assessment-A requirement added 2026-07-11. Today's implementation (`AiResultsSummary`: `overview`, `strengths`, `areasToWatch`, `notedByCaregiver` in `packages/shared-types/src/aiResultsSummary.ts`) predates that requirement — it already gets the core isolation right (the LLM never sees Assessment A's computed levels) but has no likelihood, no confidence, and no comparison output yet. See §16 for the tracked gap before treating this template as §13-compliant.

---

## 9. Clinical content review gate

Any change to: question wording, activity instructions, scoring weights/thresholds, red-flag trigger definitions, or result/report copy templates is **clinical content**, not just code. Before merging such a change:

1. Note it in `docs/clinical-review/` with what changed and why.
2. Flag it clearly in the PR description as "clinical content change — needs advisor sign-off" — do not merge to a release branch without that sign-off being recorded, even if you (Claude Code) generated a technically correct implementation.
3. This applies even to seemingly small wording tweaks — "abnormal" vs "different" is exactly the kind of change this gate exists for.

Pure engineering changes (refactors, infra, non-content bug fixes) don't need this gate.

---

## 10. Testing expectations

- `packages/scoring-engine`: unit tests for every bucket boundary, every red-flag rule, and confidence calculation — this is the most safety-critical code in the repo, treat it accordingly.
- Snapshot/lint check that scans all user-facing string literals and content JSON for the banned-words list (§2 rule 4) and confirms the disclaimer component is present on every results/report route — add this as a CI check, not just a manual review step.
- Mobile: component tests for `<ScreeningDisclaimer />`, `<TrafficLightBar />`, `<StrengthsFirstList />`, `<ConsentToggle />` since these carry the safety rules structurally.
- Backend: integration tests for the full intake → scoring → results pipeline using fixture data that includes at least one red-flag-triggering case and one low-signal case.
- Once Assessment B carries its own likelihood/confidence (§13, tracked in §16): integration tests for agreement, partial agreement, and each disagreement reason listed in §13; missing evidence on one side only; contradictory free text vs. structured answers; and a red-flag case verifying Assessment B's narrative never softens the flag (rule 8/§2).
- UI tests for the Results screen must verify: Assessment A and Assessment B never visually merge into one block, the comparison section (§14) is present whenever both assessments exist, strengths are visible for both, confidence/uncertainty are visible for both, the disclaimer is visible, and neither assessment duplicates the caregiver's raw answers back at them rather than synthesizing them (rule 13, §13 Guiding Principle).

---

## 11. Commands (fill in once scaffolded)

```bash
# Mobile
cd apps/mobile && npm install && npx expo start

# Backend
cd apps/backend && npm install && npm run start:dev

# Scoring engine tests
cd packages/scoring-engine && npm test

# Full content-safety lint (banned words, disclaimer presence)
npm run lint:content
```

---

## 12. When in doubt

This app touches child health data and vulnerable families. If a task is ambiguous between "ship it fast" and "get it clinically/ethically right," default to the latter and say so — flag the tradeoff to the user rather than silently picking speed. Refer back to `docs/product-plan.md` for the full rationale behind any of the rules above (§3 Clinical & Ethical Foundation, §10 Consolidated Safety Rules, §14 Risks & Mitigations). For the dual-assessment architecture added 2026-07-11, see §13–§16 below — §16 in particular tracks what's actually implemented today versus what this file now requires.

---

## 13. Assessment Architecture (added 2026-07-11 — overrides the single-engine framing implied elsewhere in this file where the two conflict)

EarlySteps always produces **two independent assessments**, never one merged result.

**Assessment A — Deterministic Screening Engine.** This is `packages/scoring-engine`, unchanged from §7: transparent, reproducible, version-controlled, rule-based. Never uses an LLM, never analyses free text/video/speech, never modifies itself, identical output for identical input. Input is structured questionnaire answers, structured behavioural observations, and structured activity results. Output is Assessment A's likelihood (its existing `SignLevel` vocabulary, §2 rule 2), confidence, domain scores, support-level estimate, red flags, evidence coverage, unsupported-evidence list, and recommended next steps.

**Assessment B — AI Assessment Engine.** An expert-style interpretation of *all* available evidence, including what Assessment A structurally cannot use: free-text answers, "other" responses, parent/teacher notes, developmental history, and (future) audio, video, eye-gaze, speech, and gesture analysis (§15). Assessment B may never modify Assessment A's output (rule 7, §2) and Assessment A never reads Assessment B's output.

**Assessment B output schema** (required fields — see §16 for how far today's `AiResultsSummary` is from this):

- likelihood (`Very Low` / `Low` / `Moderate` / `High` / `Very High` — separate scale from Assessment A's, rule 2 §2)
- confidence (`low` / `medium` / `high`, separate value from Assessment A's, rule 3 §2)
- reasoning (why — see the Guiding Principle below)
- developmental profile
- strengths (populated before support needs — rule 15, §2)
- support needs / support priorities, tiered Immediate / Short-term / Medium-term / Long-term, each with a stated reason
- uncertainty (explicitly named, not just a low confidence number)
- evidence summary
- home recommendations
- school recommendations
- professional-assessment priorities
- comparison with Assessment A (agreement / partial agreement / disagreement, with reasons)

**Confidence is separate from likelihood.** Confidence depends on evidence completeness, consistency, corroboration, observation quality, and contradictory evidence. A low confidence must explain why — never let a high likelihood imply high confidence by default (this already matches Assessment A's existing rule in §7).

**Comparison rules.** When Assessment A and B disagree, the screen must explain why using one or more of: unsupported text evidence, contradictory responses, insufficient evidence, missing observations, low confidence, conflicting developmental history. Never silently merge the two (rule 14, §2).

**Red flags** are evaluated independently of both engines' general scoring and never averaged away: regression, loss of speech, loss of skills, no functional communication, self-injury, severe feeding problems, severe sleep disruption, safety concerns. These always surface separately, matching Assessment A's existing exemption from the evidence gate (§2 rule 8, `packages/scoring-engine/src/redFlags.ts`).

**Free text** is valuable evidence Assessment A ignores by design. Assessment B analyses it and lets it influence confidence, reasoning, behavioural patterns, and support recommendations — without ever changing Assessment A's deterministic scores (rule 7, §2).

**What Assessment B must analyse:** social communication, reciprocal interaction, eye gaze, gestures, language, conversation, pretend play, repetitive behaviour, routines, restricted interests, sensory profile, adaptive functioning, executive functioning, emotional regulation, developmental history, parent observations, teacher observations, strengths, and protective factors — combined into meaningful developmental patterns, not scored one-by-one.

**Guiding Principle (rule 13, §2).** The parent already knows the answers they entered. The app's value isn't repeating those answers — it's synthesising all available evidence into an evidence-based assessment that explains how strongly observed characteristics align with autism-related developmental patterns, which areas contribute most, what strengths to build on, where uncertainty remains, and what to prioritise next.

Bad: "Child has poor eye contact." / "Child flaps hands."
Good: "The overall pattern of reduced reciprocal interaction, limited eye gaze, and reduced social initiation increases the likelihood of autism-related social communication differences." / "Repetitive motor behaviours together with sensory-seeking behaviour strengthen the evidence for restricted and repetitive behaviour characteristics."

Every Assessment B prompt must instruct the model to: analyse all evidence, distinguish evidence from inference, explain uncertainty, avoid hallucinations and unsupported conclusions, avoid replaying answers, produce structured reasoning, compare with Assessment A, and never modify Assessment A's output — in addition to the shared guardrail block already required by §2 rule 12/§8.

---

## 14. Result Screen layout

Every results/report route renders three parts, always in this order, never merged:

1. **Section A — Deterministic Screening Assessment.** Assessment A's existing fields per §7/§13: likelihood, confidence, domain scores, support-needs estimate, red flags, evidence coverage, unsupported answers, recommended next steps. This is what `ResultsScreen.tsx` already renders today.
2. **Section B — AI Assessment.** Assessment B's fields per §13: likelihood, confidence, clinical reasoning, strengths, support needs, developmental profile, key behavioural patterns, areas requiring further evaluation, recommended interventions, home support suggestions, school support suggestions, parent priorities. **Not yet built** — see §16.
3. **Comparison Section.** Agreement / partial agreement / disagreement, with reasons when disagreeing (§13). **Not yet built** — see §16.

The `<ScreeningDisclaimer />` (§6) must render on this screen regardless of whether Section B exists yet — that requirement (§2 rule 5) is unaffected by this migration.

---

## 15. Future multimodal inputs

Design Assessment B (never Assessment A — rule 7, §2) to eventually support: questionnaire, interview, speech, audio, video, eye tracking, facial expression, gestures, movement, and play behaviour. The Assessment B output schema (§13) stays the same regardless of which evidence sources feed it — adding a modality should never require changing the result shape, only what feeds it.

This slots into existing rules, not new ones: media consent and encryption (§2 rule 9), the `<ConsentToggle />` component (§6), and analytics exclusions (§2 rule 10) all already generalize to these future inputs without modification. Always require explicit, freshly-given consent before analysing video, audio, or photographs; never analyse media without it.

---

## 16. Migration status (as of 2026-07-12 — keep this section current as the gap closes)

This file documents the target dual-assessment architecture (§13/§14). As of 2026-07-12 (issue #104, two PRs) the codebase implements it — the gaps tracked here since 2026-07-11 are closed. Kept as a record of what shipped and where, and because §16's own instruction is to stay current, not because gaps remain:

- **Independent likelihood/confidence on the AI side — closed.** `AiResultsSummary` now carries `likelihood`, `confidence`, `reasoning`, `developmentalProfile`, `supportPriorities` (tiered Immediate/Short-term/Medium-term/Long-term), `uncertainty`, `homeRecommendations`, `schoolRecommendations`, and `professionalAssessmentPriorities`, per §13's schema — validated against `ai-summary-schema.ts`'s Zod schema, with the prompt behind `claude-ai-summary.client.ts` rewritten to request them. See `docs/clinical-review/2026-07-11-ai-results-summary.md` and `2026-07-11-dual-assessment-architecture.md`.
- **Comparison engine — closed.** New package `@earlysteps/comparison-engine` computes agreement/partial_agreement/disagreement (with one of six reasons on disagreement) from Assessment A's and Assessment B's independently-produced output, never feeding either back into the other (rule 7 enforced via `Pick<>`-typed inputs). New `POST /children/:childId/comparison` backend endpoint.
- **Comparison Section in the UI — closed.** `ResultsScreen.tsx` now renders Section A / Assessment B / Comparison as three explicit, testID-verified, non-nested regions (§14), replacing the old "AI narrative as supplementary text" layout.
- **Components — built.** `<AIAssessmentCard />`, `<ComparisonCard />`, `<ConfidenceBadge />`, `<SupportPrioritiesCard />` (§6) all exist under `apps/mobile/src/components/`.
- **Still pending, unrelated to the architecture itself:** every piece of this migration is logged in `docs/clinical-review/README.md`'s sign-off log as `_pending_` advisor sign-off (the comparison-reason heuristic, the professional-referral carve-out, and all newly authored section headings/framing copy especially) — clinical content, not engineering, per §9. Don't treat "implemented" above as "clinically approved."
- Any further change to likelihood/confidence output, comparison logic, or which engine owns which field is still an architecture change per rule 16 (§2) — same review discipline as clinical content (§9).
