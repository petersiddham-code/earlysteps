# @earlysteps/backend

Node.js + NestJS API wiring the **intake → scoring → results** pipeline (CLAUDE.md §3, product
plan §6–§8). Scoring is always deterministic — this app calls `@earlysteps/scoring-engine`'s
`recompute()`; it never computes a level, support estimate, or red flag itself.

## What's implemented

- `POST /children/:childId/intake-responses` — persist new `IntakeResponse[]`, recompute
  against the child's **full** answer history (not just the new batch), persist the resulting
  `DomainProfile` / `SupportLevelEstimate` / `RedFlag[]` as a new append-only snapshot, and
  return the caregiver-safe results view.
- `GET /children/:childId/results` — return the latest results view, or 404 if nothing has
  been computed yet.
- The results view (`src/screening/results-view.ts`) strips the raw numeric domain score
  before it ever leaves the API — only the on-list `SignLevelLabel` + confidence per domain,
  the support-level term + confidence, the recommendation tier, and the verbatim
  `SCREENING_DISCLAIMER` are returned (product plan §4.4: "never a raw numeric score shown to
  a parent").

## What's explicitly out of scope here

See `docs/clinical-review/content-gaps.md` items 5–6:

- **No Family/Child onboarding, consent enforcement, or auth.** Endpoints operate on an
  already-existing `childId`. Building the Consent Center / Child Profile Setup flow (product
  plan Screens 2–3) and the backend CRUD + consent gating behind it is a separate piece of work.
- **No LLM wiring yet.** `src/ai/prompts/` templates exist but nothing calls the model — the
  results view returns only what the deterministic engine computed.
- **`deriveRecommendationTier`** (in `@earlysteps/scoring-engine`) is a placeholder heuristic
  for the SupportLevelEstimate-only case (no red flag), pending clinical sign-off.

## Data model

`prisma/schema.prisma` maps product plan §7. No migration has been generated — there was no
live Postgres instance available to generate one against. Before deploying:

```bash
cp .env.example .env   # point DATABASE_URL at a real Postgres instance
pnpm --filter @earlysteps/backend exec prisma migrate dev --name init
```

`prisma generate` (client generation, no DB connection required) is verified to run cleanly.

## Commands

```bash
pnpm --filter @earlysteps/backend prisma:generate   # generate the Prisma client
pnpm --filter @earlysteps/backend start:dev          # run with tsx watch (needs a live DB)
pnpm --filter @earlysteps/backend typecheck
pnpm test                                            # includes this app's integration tests (Vitest)
```

Like the pure packages, there is no compiled production build yet — `start`/`start:dev` run
TypeScript source directly via `tsx`. A real deploy needs either a bundler (esbuild/tsup) or
TypeScript project references to emit a `dist/` that doesn't try to compile the whole workspace
under one `rootDir`; that's a follow-up once there's real infra to deploy to.

## Testing without a live database

Integration tests (`test/screening.integration.spec.ts`) run the full pipeline — intake submit
→ `recompute()` → persistence → results view — against an in-memory `ScreeningRepository`
implementation (`src/screening/testing/in-memory-screening.repository.ts`), not a real Postgres
instance. That repository is a test double only; it is never wired into `AppModule`. Cover at
least one red-flag-triggering case and one low-signal case per CLAUDE.md §10.
