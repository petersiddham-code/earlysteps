# EarlySteps

A home support & developmental screening companion for families noticing possible
autism-related developmental signs early. **This is a screening and support tool, not a
diagnostic one.** See [`CLAUDE.md`](./CLAUDE.md) for the non-negotiable safety rules and
[`docs/product-plan.md`](./docs/product-plan.md) for the full product spec.

## Monorepo layout

| Path | What |
|---|---|
| `packages/shared-types` | Shared TypeScript types + the fixed, on-list safety vocabulary (result labels, tiers, support terms) as `const` unions. |
| `packages/scoring-engine` | Deterministic, rule-based scoring + independent red-flag rules. Pure TS, no UI/network. Heavily unit-tested. |
| `packages/content` | Question banks, weights, and result copy as versioned JSON — editable by non-engineers, gated by clinical review. |
| `src/ai/prompts` | LLM system-prompt templates + the shared `_guardrails.md` block prepended to every call. |
| `apps/{mobile,backend,admin}` | Placeholders this phase — not yet implemented. |
| `docs/clinical-review/` | Clinical content-review sign-off notes and the content-gap log. |

This is the **foundation phase**: the framework-agnostic, safety-critical core. No app UI
yet. See `docs/clinical-review/content-gaps.md` for what still needs clinical sign-off.

## Commands

```bash
pnpm install            # install workspace
pnpm test               # run all package unit tests (Vitest)
pnpm test:coverage      # tests + coverage (weighting logic must stay high)
pnpm lint               # eslint + prettier
pnpm lint:content       # safety gate: banned words + off-list result labels
pnpm typecheck          # type-check all packages
```

## Safety-first, always

Anything touching question wording, activity instructions, scoring weights/thresholds,
red-flag definitions, or result/report copy is **clinical content** and requires advisor
sign-off recorded under `docs/clinical-review/` before merging to a release branch
(`CLAUDE.md §9`). The scoring engine is deterministic — the LLM explains scores, it never
invents or overrides them.
