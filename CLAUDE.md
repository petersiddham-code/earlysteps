# CLAUDE.md — EarlySteps

Instructions for Claude Code when working in this repository. Read this fully before writing or modifying any code, copy, or prompts.

---

## 1. What this project is

**EarlySteps** is a mobile app that helps low-income families notice possible autism-related developmental signs early, understand their child's likely support needs, and get practical home activities — while making it unmistakably clear this is a **screening and support tool, not a diagnostic one**.

Full product spec lives at `/docs/product-plan.md` (the source document — copy it into the repo root under `docs/` before starting; treat it as the source of truth for scope, screens, data model, and question banks). If anything in this file conflicts with that document on a *product* decision, the product plan wins. If anything conflicts on a *safety/language* rule, this file wins — the rules below are stricter versions specifically for code generation.

**Primary users:** parents/caregivers, often on low-end Android devices, low bandwidth, sometimes low literacy, in regions with little or no access to paediatric developmental specialists.

---

## 2. Non-negotiable rules (apply to every file you touch)

These are not style preferences. Violating them is a shipped safety bug, not a nitpick.

1. **Never generate copy, code, or logic that states or implies a diagnosis.** No string anywhere in the app may say or imply "your child is autistic," "your child has autism," "your child is not autistic," or equivalent. Grep for this before finishing any task that touches user-facing copy.
2. **Only use these result labels**, verbatim, anywhere results are shown or generated: `Low signs observed`, `Some signs observed`, `Many signs observed`, `Support activities can begin now`, `Formal assessment is recommended`, `Formal assessment strongly recommended soon`.
3. **Only use these support-level terms**, always paired with a confidence level (`low` / `medium` / `high`): `mild support needs`, `moderate support needs`, `high support needs`.
4. **Banned words in any user-facing string:** defect, abnormal, disorder (as a label applied to the child), broken, wrong, deficient, disease, sick, cure, fix. Use instead: support needs, developmental differences, communication differences, sensory needs, learning style.
5. **Every screen that displays a result, summary, or report must render the disclaimer** (component: `<ScreeningDisclaimer />`, see §6): *"This is a screening tool, not a diagnosis. Only a qualified professional (paediatrician, psychologist, or developmental specialist) can diagnose autism."* — the product plan §3.2 wording, verbatim (that section is the single source of truth for the on-screen sentence; the shorter form in product plan §9.3 is the LLM-prompt variant, not the screen copy). Do not let a code path reach a results view without it.
6. **Strengths render before/alongside support needs, never after only.** If you build a results component and strengths aren't visible above the fold or in the first tab, that's a bug.
7. **The scoring engine is deterministic and rule-based (see §7), never LLM-inferred.** Any LLM call may explain, phrase, or summarize a score — it may never invent or override one. If you're tempted to have the model "just decide" a support level from raw text, stop and route it through the scoring engine instead.
8. **Red-flag rules are hard-coded and evaluated independently of the general domain scoring**, so one serious sign can never get averaged away. See `docs/product-plan.md §8` for the trigger list (loss of previously-acquired skills, no name-response after repeated attempts, no functional communication, self-injury risk indicators, severe feeding/sleep disruption, sudden behaviour change, safety risk).
9. **All child-identifying media (audio/video/photos) is opt-in per instance, encrypted, and time-boxed.** Never add a code path that captures or stores media without an explicit, freshly-given consent flag for that specific capture.
10. **No analytics/telemetry event may include raw question answers, scores, or media.** Only anonymized, aggregate usage events (e.g., "intake_started") are permitted. If you're adding an analytics call, check it against this rule before committing.
11. **No third-party ad SDKs, no data broker integrations, no selling/sharing user data.** Don't add dependencies that do this even for a "just in case" growth feature.
12. **Every LLM system prompt used in this app must include the shared guardrail block** from `docs/product-plan.md §9` (or `src/ai/prompts/_guardrails.md` once scaffolded). Never call the model for user-facing analysis/copy without it.

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
| Auth | Passwordless (magic link or OTP) — avoid storing anything beyond what's needed to authenticate a parent account |
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

- `<ScreeningDisclaimer />` — the fixed disclaimer sentence (§2 rule 5). Pull the exact text from `docs/product-plan.md §3.2`, don't paraphrase it.
- `<TrafficLightBar domain confidence level />` — never a raw numeric score shown to a parent.
- `<StrengthsFirstList />` — enforces strengths-before-needs ordering at the component level so it can't be reordered by accident downstream.
- `<RedFlagBanner />` — calm, non-alarmist styling per `docs/product-plan.md §8` tone guidance; this is not the same visual treatment as an error state.
- `<ConsentToggle scope="data_storage | ai_analysis | media_capture | professional_sharing" />` — layered consent, each togglable independently, per `docs/product-plan.md §4.7`.

---

## 7. Scoring engine rules

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

This app touches child health data and vulnerable families. If a task is ambiguous between "ship it fast" and "get it clinically/ethically right," default to the latter and say so — flag the tradeoff to the user rather than silently picking speed. Refer back to `docs/product-plan.md` for the full rationale behind any of the rules above (§3 Clinical & Ethical Foundation, §10 Consolidated Safety Rules, §14 Risks & Mitigations).
