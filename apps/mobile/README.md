# @earlysteps/mobile

React Native (Expo) app implementing the real onboarding flow against the live backend API
(product plan Screens 1–3): Splash → Consent Center → Child Profile Setup. The Parent
Questionnaire and Results screens (Screens 4, 7) are next — `ComingSoonScreen` is the
temporary landing spot after onboarding until those exist.

## What's implemented

**`src/api/`** — typed client for every backend route (see the API-client PR); every screen
below is wired to the real endpoints, not sample data.

**`src/session/`** — `SessionProvider`/`useSession`: the current `familyId`/`childId`
persisted via `AsyncStorage` so the app resumes where it left off across restarts, instead of
re-onboarding every launch.

**`src/navigation/`** — a `@react-navigation/native-stack` navigator: `Splash` (routes based
on resumed session state) → `ConsentCenter` → `ChildProfileSetup` → `ComingSoon`.

**`src/screens/`**:

- **`SplashScreen`** — waits for the session to load, then routes: no family yet →
  ConsentCenter; a family but no child → ChildProfileSetup; both → onward.
- **`ConsentCenterScreen`** — creates a `Family` on first visit (consent itself is granted via
  separate, per-scope `PATCH` calls after — never bundled into account creation, CLAUDE.md §2
  rule 9), renders all four `<ConsentToggle/>`s wired to `updateConsent()`. "Continue" proceeds
  regardless of what was granted — enforcement happens at the API layer
  (`data_storage`-gated intake persistence), not by blocking navigation here.
- **`ChildProfileSetupScreen`** — nickname / age band / language(s) (product plan Screen 3, no
  photo/avatar since there's no media capture at this step). Age band is restricted to
  `MVP_AGE_BANDS` (Toddler/Preschool) — the other two bands have no question content yet
  (`docs/clinical-review/content-gaps.md` item 4), so offering them would dead-end at an empty
  questionnaire. Calls `createChild()`, persists the id, moves on.
- **`ComingSoonScreen`** — confirms the saved family/child ids and offers "Start over" (clears
  the session, back to Splash) until the questionnaire ships.

**`src/components/`** — the five safety-carrying shared components (CLAUDE.md §6), now
consumed by the real screens above instead of a standalone demo:

- **`<ScreeningDisclaimer />`** — renders `SCREENING_DISCLAIMER` from `@earlysteps/shared-types`
  verbatim. No `text`/`children` prop exists, so there's no way to render it with different
  wording (CLAUDE.md §2 rule 5).
- **`<TrafficLightBar domain level confidence />`** — takes the bucketed `SignLevel`, never a
  numeric score; there is no prop through which a raw 0–100 could be passed and rendered
  (product plan §4.4).
- **`<StrengthsFirstList strengths needs />`** — `strengths` and `needs` are separate required
  props, and the component always renders the strengths section first internally, so the
  ordering can't be flipped by a caller (CLAUDE.md §2 rule 6).
- **`<RedFlagBanner redFlagTypes />`** — calm, non-error styling (soft teal, not alert-red);
  surfaces an additional resource block only for urgent types (`self_injury_risk`,
  `safety_risk`). Copy comes from `@earlysteps/content`, not hardcoded (product plan §4.8).
- **`<ConsentToggle scope value onChange />`** — one scope per toggle
  (`data_storage` / `ai_analysis` / `media_capture` / `professional_sharing`), controlled
  component, label + explanation from `@earlysteps/content` (product plan §4.7).

Every component has a test in `@testing-library/react-native` (CLAUDE.md §10).

## Commands

```bash
pnpm --filter @earlysteps/mobile start          # Expo dev server (scan QR with Expo Go, or press w for web)
pnpm --filter @earlysteps/mobile typecheck
pnpm --filter @earlysteps/mobile test           # Jest + jest-expo, not Vitest — see "Why Jest" below
```

## Why Jest, not Vitest

Every other package in this workspace uses Vitest. Mobile is a deliberate exception:
`jest-expo` is the Expo team's own maintained preset, purpose-built for Metro/RN's module
system and Babel-based Flow/JSX stripping. Forcing Vitest onto React Native would mean
fighting far more deeply embedded tooling assumptions than the ESM/CJS issues Vitest already
solves cleanly for the backend. `pnpm test` at the repo root does not run mobile's tests —
run `pnpm --filter @earlysteps/mobile test` explicitly, or use the root `test:mobile` script.

## pnpm workspace + Metro

Two real bugs were found and fixed here via a live `expo export --platform web` bundle (not
just unit tests, which didn't catch either):

1. `metro.config.js` originally set `resolver.disableHierarchicalLookup = true` (copied from a
   generic pnpm-monorepo guide) — it broke resolution of Expo's own nested transitive deps
   (e.g. `expo-modules-core`) living under pnpm's `.pnpm` structure. Removed; symlink support
   (`unstable_enableSymlinks`) + `watchFolders` pointing at the workspace root is sufficient.
2. Workspace packages (`@earlysteps/shared-types`, `@earlysteps/content`) use explicit `.js`
   extensions on relative imports (real Node ESM style) even though the files are `.ts`.
   Metro takes a literal `.js` extension at face value and won't try `.ts` — same class of
   issue Jest hit (see `jest.config.js`'s `moduleNameMapper`). Fixed with a custom
   `resolver.resolveRequest` that strips a leading-dot `.js` extension before resolving.

`react-dom` + `react-native-web` are installed so `expo export --platform web` (or
`pnpm --filter @earlysteps/mobile web`) works without Xcode/Android SDK — useful for a quick
headless bundle-correctness check in any environment, mobile-only target notwithstanding.

## Testing AsyncStorage

`@react-native-async-storage/async-storage`'s official Jest mock
(`@react-native-async-storage/async-storage/jest/async-storage-mock`) just exports a
`jest.fn()`-based object — it does **not** self-register via `jest.mock()`. Listing it under
`setupFiles` does nothing (confirmed by hand: still crashes with "NativeModule: AsyncStorage is
null"). It has to be wired via `moduleNameMapper`, redirecting every import of the real package
straight at the mock file (see `jest.config.js`).

## Connecting to a real backend

`getApiBaseUrl()` (`src/api/config.ts`) resolves `EXPO_PUBLIC_API_URL` first, then derives the
host from Metro's dev-server `hostUri` (works from a physical device via Expo Go on the same
network as your dev machine, not just simulator/web where `localhost` resolves), falling back
to `localhost:3000`. Run `apps/backend` alongside this app (see its README) to exercise the
real onboarding flow end to end.
