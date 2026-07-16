# Media (photo/video/audio) capture and assessment — architecture plan (issue #133)

**Date:** 2026-07-16
**Content changed:** none. This is a planning document — no code, question wording, weight,
red-flag rule, or result copy ships in this PR.

## What was asked

Issue #133 shipped with only a title and no body: "Plan and Execute for the uploading of
video, audio & image based assessment." No comments, no acceptance criteria. Given the size
of what that title implies — an entire capture → storage → AI-analysis pipeline touching
mobile, backend, and Assessment B's prompt/schema — three scope questions were put to the
user before any code was written:

1. **How big should this first PR be?** Answered: **plan only, no code yet.** This document
   is that plan; implementation is deliberately deferred to follow-up issues (below).
2. **What backs object storage**, given the repo has no S3/MinIO credentials or config
   today? Answered: **a local-filesystem dev stub behind an S3-shaped interface**, so a real
   bucket is a config swap later, not a rewrite.
3. **Which media types are in scope?** Answered: **all three — photo, video, and audio** —
   for planning purposes; Phase 1 implementation still ships them as separate, near-identical
   follow-up slices (below) rather than one large PR.

## Current-state inventory

- **Consent scaffolding exists and is unused.** `<ConsentToggle scope="media_capture" />`
  (`apps/mobile/src/components/ConsentToggle/ConsentToggle.tsx`) and the `media_capture`
  `ConsentScope` (`packages/shared-types/src/vocabulary.ts`) already exist, with copy already
  authored in `packages/content`. `content-gaps.md` already flags this: *"`media_capture` and
  `professional_sharing` remain stored and toggleable but ungated — no media capture feature
  exists yet to enforce them against."* This plan closes that gap for `media_capture` only.
- **Everything else is greenfield.** No capture UI (product plan §5 item 6, "Observation
  Recorder," is unbuilt), no upload endpoint, no object-storage client or config, no
  `MediaAsset`-shaped type anywhere in `packages/shared-types`, no retention/deletion job.
  `apps/backend` and `apps/mobile` are real NestJS/Expo apps (not placeholders — the repo
  README is stale on this point), so this plugs into existing module/screen patterns rather
  than starting a new app.
- **The consent-enforcement pattern to copy already exists**: `ai_analysis` consent gates the
  free-text response-analysis stage today — an ungranted flag returns 403 and the rest of the
  app still works (`content-gaps.md`, issue #26/#76 lineage). `media_capture` enforcement
  should follow the identical shape.

## Phasing — and why it's split this way

**Phase 1 (issue #134) — capture, consent enforcement, encrypted storage. No AI analysis of
the media.** **Phase 2 (issue #135) — wiring stored media into Assessment B as evidence.**
These are separate issues,
not separate PRs of one issue, because Phase 2 is explicitly an *architecture change* under
CLAUDE.md rule 16 (§2): it changes which evidence Assessment B ingests, needs its own prompt
rewrite behind `_guardrails.md`, and needs advisor sign-off before it ships — exactly the same
gate every likelihood/confidence/comparison change has needed so far (see the 2026-07-11
dual-assessment entries in the sign-off log above). Bundling storage plumbing and clinical AI
wiring into one review would make the storage/consent engineering wait on a clinical sign-off
it doesn't need, and would make the clinical review harder to isolate from routine
infrastructure. Rule 7 (§2) also means Phase 1 must ship in a state where Assessment A never
sees media, and Phase 2 must ship in a state where Phase 1's stored assets are the *only*
thing that changes for Assessment B — no other Assessment B field gets touched by this work.

### Phase 1 design (issue #134)

**Shared types** — new `packages/shared-types/src/media.ts`:
```
type MediaKind = 'photo' | 'video' | 'audio'
interface MediaAsset {
  id: string
  childId: string
  kind: MediaKind
  mimeType: string
  storageKey: string        // opaque pointer, not a raw path — see storage adapter below
  capturedAt: string
  retentionExpiresAt: string  // capturedAt + family's retention window, default 90d (product plan §4.7)
  retainedByParent: boolean   // true if parent explicitly overrides auto-delete
  consentId: string           // which ConsentToggle grant authorized this specific capture
  deletedAt: string | null
}
```
Mirrors the `MediaAssets[]` shape already sketched in product plan §7's data model
(`type, consent_id, retention_expiry, encrypted_uri`), renamed `kind`/`storageKey` to match
this repo's existing naming conventions elsewhere in `shared-types`.

**Backend** — new `apps/backend/src/media/` module (`MediaController`, `MediaService`,
`media.guard.ts`), plus a new `MediaAsset` Prisma model (new migration) keyed to `Child`.

- `MediaConsentGuard` mirrors `PremiumTierGuard`/the `ai_analysis` gate exactly: no
  `media_capture` consent on file for that child → 403, upload rejected, nothing written.
  This is the one new piece of *enforcement* logic; everything else below is plumbing.
- `ObjectStorageService` is an interface (`put`, `get`, `delete`, each keyed by opaque
  `storageKey`) with one implementation shipped in Phase 1 — `LocalDiskObjectStorageService`,
  writing encrypted blobs under a gitignored data directory — and a second implementation
  (`S3ObjectStorageService`) stubbed but not wired until real bucket credentials exist. A
  `STORAGE_DRIVER=local|s3` env var selects between them, so swapping in S3 later is a config
  change, matching the user's answer above and the product plan's "S3-compatible" architecture
  row (§6) without requiring an external account to build or test Phase 1.
- Encryption: per-family symmetric key (product plan §4.7's "media encrypted with per-family
  keys"), generated on first upload and stored server-side associated with `Family`; media is
  encrypted before it touches disk in either storage driver, never plaintext at rest.
- Retention: a scheduled job (NestJS `@Cron`, daily) hard-deletes any `MediaAsset` past
  `retentionExpiresAt` where `retainedByParent` is false — real deletion, not soft-delete, per
  product plan §4.7's "one-tap 'Delete everything' with real deletion." The parent-facing
  retention-window control (product plan §5 item 13, "Privacy Controls") is explicitly **not**
  built in this phase — the job ships with the fixed 90-day default only; a settings UI to
  change that window is its own follow-up.

**Mobile** — new `ObservationRecorderScreen` (product plan §5 item 6): capture via
`expo-image-picker` (photo), `expo-camera` (video), `expo-av` (audio) and background upload
via `expo-file-system` — all first-party Expo libraries, consistent with the existing stack,
not a new framework. A persistent, calm (non-alarmist, matching `RedFlagBanner`'s tone
guidance, not its visual treatment) consent reminder sits above the capture controls, reusing
the existing `<ConsentToggle scope="media_capture" />` rather than a new component. A
"Skip — I'll describe instead" affordance routes to the existing free-text entry points
already used elsewhere in the questionnaire/follow-up flow, so a caregiver who declines media
capture is never blocked from providing evidence some other way.

**Explicitly out of scope for Phase 1**, tracked as separate future issues:
- Any AI analysis of captured media (Phase 2, below).
- `professional_sharing` consent enforcement — different scope, different gate, no feature
  to enforce it against yet either.
- The Privacy Controls retention-window *setting* (product plan §5 item 13) — the fixed
  90-day default ships; a UI to change it doesn't.
- On-device Whisper transcription of captured audio — not needed to store audio; only
  relevant once Phase 2 needs a text representation to feed Assessment B.

### Phase 2 design (issue #135, separate from Phase 1)

Wires Phase 1's stored `MediaAsset`s into Assessment B as an additional evidence source,
per CLAUDE.md §15 ("Design Assessment B... to eventually support... video, audio...").
Requires, before merge:

- A rewritten `results-summary` prompt (still behind the shared `_guardrails.md` block, §8)
  describing what media evidence is available and how to weigh it alongside free text —
  distinct from, and never overriding, Assessment A's fields (rule 7 unchanged).
- A schema addition to `AiResultsSummary`'s evidence summary noting which modalities
  contributed to a given reasoning statement, so the Results screen can say *why* (rule 13,
  §13's Guiding Principle — media evidence must be synthesized into a pattern, never just
  described back, e.g. not "video showed hand flapping" alone but folded into the same kind
  of developmental-pattern reasoning already required of free text).
- Its own `docs/clinical-review/` entry and advisor sign-off, per rule 16 (§2) — this is
  exactly the kind of "which engine owns which field" change that gate exists for.
- Confirmation that red flags (§2 rule 8) still evaluate independently of whatever Phase 2
  adds — a red flag must never be softened by an AI read of ambiguous video/audio.

Analysis approach itself (frame-sampled description vs. a vision-capable model call vs.
on-device pre-processing before any upload) is intentionally left undecided here — it's a
design question for that follow-up, not a decision to make speculatively now.

## Follow-up issues filed

- **Issue #134** — Phase 1 (capture UI, consent enforcement, encrypted storage, retention job).
- **Issue #135** — Phase 2 (Assessment B media-evidence wiring), blocked on #134.

## Sign-off status

Signed off by Peter Siddham, 2026-07-16 — the three scope decisions above (plan-only this
issue, local-disk storage adapter behind an S3-shaped interface, all three modalities in
scope for planning) were confirmed directly. No clinical content ships with this plan, so no
further advisor sign-off is needed for *this* document — Phase 1's consent-enforcement
behavior and Phase 2's prompt/schema changes will each need their own sign-off when they
actually ship, per the phasing rationale above.
