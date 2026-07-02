# @earlysteps/backend

Node.js + NestJS API wiring the **intake → scoring → results** pipeline (CLAUDE.md §3, product
plan §6–§8). Scoring is always deterministic — this app calls `@earlysteps/scoring-engine`'s
`recompute()`; it never computes a level, support estimate, or red flag itself.

## What's implemented

**Families (`src/families/`, product plan §4.7):**

- `POST /families` — create a family (`locale`, optional `low_bandwidth_mode`). Consent is
  deliberately not settable here — grant it via the consent endpoint after, so it's "freshly
  given" (CLAUDE.md §2 rule 9), not bundled into account creation.
- `GET /families/:familyId`
- `PATCH /families/:familyId/consent` — body `{ scope, granted }`, one scope per call, matching
  `<ConsentToggle/>`'s one-scope-per-`onChange` UX. Fail-safe default: a new family has nothing
  granted (`consent_flags: {}`).
- `POST /families/:familyId/children` — `{ nickname, age_band, languages }`.
- `GET /families/:familyId/children/:childId`

**Screening (`src/screening/`):**

- `POST /children/:childId/intake-responses` — persist new `IntakeResponse[]`, recompute
  against the child's **full** answer history (not just the new batch), persist the resulting
  `DomainProfile` / `SupportLevelEstimate` / `RedFlag[]` as a new append-only snapshot, and
  return the caregiver-safe results view. **Requires `data_storage` consent** for the child's
  family — an unconsented or unknown child gets a 403, never a silent write (CLAUDE.md §2
  rule 9).
- `GET /children/:childId/results` — return the latest results view, or 404 if nothing has
  been computed yet.
- `GET /children/:childId/intake-responses` — the full raw answer history. Read-only; lets a
  client reconstruct caregiver-authored content (e.g. `apps/mobile`'s Results screen deriving
  strengths from the caregiver's own answers) without a server-side derivation endpoint per
  use case. Scoring itself only ever happens via `submitIntakeResponses`.
- The results view (`src/screening/results-view.ts`) strips the raw numeric domain score
  before it ever leaves the API — only the on-list `SignLevelLabel` + confidence per domain,
  the support-level term + confidence, the recommendation tier, and the verbatim
  `SCREENING_DISCLAIMER` are returned (product plan §4.4: "never a raw numeric score shown to
  a parent").

## What's explicitly out of scope here

See `docs/clinical-review/content-gaps.md` items 5–6:

- **No auth.** Every endpoint is unauthenticated. Anyone with a `familyId`/`childId` can read
  or write it — this is not real account security.
- **Only `data_storage` consent is enforced.** `ai_analysis`, `media_capture`, and
  `professional_sharing` are stored and independently toggleable, but nothing gates on them
  yet — no LLM calls, media capture, or report sharing exists to enforce them against.
- **Mobile isn't wired to these endpoints.** `<ConsentToggle/>` and the demo screen still use
  local component state / sample data.
- **No LLM wiring yet.** `src/ai/prompts/` templates exist but nothing calls the model — the
  results view returns only what the deterministic engine computed.
- **`deriveRecommendationTier`** (in `@earlysteps/scoring-engine`) is a placeholder heuristic
  for the SupportLevelEstimate-only case (no red flag), pending clinical sign-off.

## Data model

`prisma/schema.prisma` maps product plan §7. The initial migration
(`prisma/migrations/20260702042258_init`) is committed and has been run against a real local
Postgres — verified end to end via the actual `start:dev` server, not just the in-memory test
doubles. To set up your own local database:

```bash
createdb earlysteps   # or your Postgres tool of choice
cp .env.example .env  # then edit DATABASE_URL to match your local user/db
pnpm --filter @earlysteps/backend exec prisma migrate dev
```

Note the connection string needs an explicit user for Prisma even when `psql` connects fine
via peer/socket auth without one — `postgresql://<your-macos-username>@localhost:5432/earlysteps`
is the usual fix if you hit `P1010: User `` was denied access`.

`prisma generate` (client generation, no DB connection required) is verified to run cleanly
even without a live database — useful for CI/typecheck where nothing needs to actually query.

## Commands

**Required after every fresh clone / `pnpm install`** — `@prisma/client`'s own postinstall
can't find a non-default schema location (`apps/backend/prisma/schema.prisma`), so the
generated client types don't exist until you run this explicitly. `pnpm typecheck` and
`pnpm test` will fail with confusing "property does not exist on type PrismaService" errors
without it — this only needs a `DATABASE_URL` string to resolve the schema's `env()`
reference, not a real running database:

```bash
cp .env.example .env   # or export DATABASE_URL yourself
pnpm --filter @earlysteps/backend prisma:generate
```

```bash
pnpm --filter @earlysteps/backend start:dev          # run with ts-node --watch (needs a live DB)
pnpm --filter @earlysteps/backend typecheck
pnpm test                                            # includes this app's integration tests (Vitest)
```

Dev/start run via `ts-node`'s ESM loader, not `tsx`/esbuild. NestJS's implicit constructor
injection (`constructor(private readonly x: SomeService)`, no `@Inject()` needed) depends on
TypeScript's `emitDecoratorMetadata`, which requires the real type checker — esbuild-based
tools don't do that, so `tsx` silently leaves every implicitly-typed constructor param
`undefined` at runtime (confirmed by hand: it does NOT throw at startup, only when a route
handler runs). `ts-node` runs the actual TypeScript compiler and emits correct
`design:paramtypes` metadata. Verified with a throwaway HTTP smoke test hitting both routes.

Like the pure packages, there is no compiled production build yet — `start`/`start:dev` run
TypeScript source directly. A real deploy needs either a bundler (esbuild/tsup, if paired with
an explicit decorator-metadata plugin) or TypeScript project references to emit a `dist/` that
doesn't try to compile the whole workspace under one `rootDir`; that's a follow-up once there's
real infra to deploy to.

## Testing without a live database

Integration tests (`test/screening.integration.spec.ts`, `test/families.integration.spec.ts`)
run the full pipeline — intake submit → `recompute()` → persistence → results view, and
family/child/consent CRUD — against in-memory `ScreeningRepository`/`FamiliesRepository`
implementations (`src/*/testing/`), not a real Postgres instance. Those repositories are test
doubles only; never wired into `AppModule`. Cover at least one red-flag-triggering case and one
low-signal case per CLAUDE.md §10, plus the consent-denial and consent-grant paths.

**A note on live HTTP smoke-testing this app**: a throwaway script that makes a single outbound
`fetch()` to a `moduleRef.createNestApplication()` instance under `node --loader ts-node/esm`
works fine, but a script making **two or more sequential outbound `fetch()` calls** in the same
process reproducibly crashed the loader on Node v25.9.0 with an unprintable
`[Object: null prototype]` error, before any of the script's own code even ran — confirmed via
`tsc --noEmit` (zero errors on the exact same file) and via testing each call in isolation
(each succeeded individually). This looks like a `ts-node/esm`-loader-specific bug under this
Node version, not an application defect — the deployed server itself only ever handles one
*inbound* request at a time from an external client, a different code path that's already
proven to work. If you hit this while smoke-testing, keep throwaway scripts to a single
request, or use the automated `Test.createTestingModule` integration tests instead.
