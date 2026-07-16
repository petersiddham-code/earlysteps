# Clinical sign-off boot gate + Admin Console visibility (issue #129)

**Date:** 2026-07-16
**Content changed:** none. No question wording, weight, threshold, red-flag definition, or
result/report copy changed. This PR is pure engineering: enforcement and visibility around
the *existing* `needs_clinical_signoff` flags, not a change to what any of them say.

## What was asked

Issue #129 flagged `packages/content/weights/domain-weights.json` (and, related, the bucket
thresholds in `packages/scoring-engine/src/buckets.ts`) as placeholder data that "none of it
is safe to show a real family until a qualified developmental advisor reviews and replaces
them." The issue itself is explicit that the real fix needs a domain expert, not an engineer:
"No amount of refactoring the code closes this gap; it's waiting on clinical input."

Scoped with the user before implementation: this PR does **not** attempt to derive or
propose real clinical weights (that would mean an AI fabricating clinical judgment — exactly
what CLAUDE.md §2/§9 exist to prevent). Instead it closes the *engineering* half of the gap —
until now, `needs_clinical_signoff: true` was enforced only by a JSON field, a doc comment,
and reviewer discipline. Nothing in the code actually stopped a production boot while it was
still true, and only one of the eight content files carrying that flag (red-flag copy) had
any visibility in the Admin Console.

## What changed

1. **`clinicalSignoffStatus()` / `unsignedOffClinicalContent()`** (new,
   `packages/content/src/clinicalSignoffStatus.ts`) — the single place that knows every
   content file carrying `needs_clinical_signoff` (weights, evidence floors, result copy,
   red-flag copy, domain resources, follow-ups, AI-results-summary copy, comparison copy)
   and its current status.
2. **Boot-time gate** (new, `apps/backend/src/startup/clinical-content-gate.ts`,
   `assertClinicalContentSafeToBoot`) — wired into `main.ts` before `NestFactory.create()`.
   Refuses to start (`throw`, before the HTTP server ever listens) when `NODE_ENV=production`
   and any content is still unsigned-off. In every other environment (dev, test, CI —
   nothing in this repo currently sets `NODE_ENV=production`) it logs a loud warning instead,
   so local development and CI are unaffected.
3. **Admin Console visibility** — `AdminContentSummary.clinical_signoff` (new field) surfaces
   all eight files' sign-off status, including weights and evidence floors, which are
   deliberately excluded from admin-draftable content (issue #127) and previously had *no*
   visibility anywhere in the console. `AdminContentScreen` renders a new "Clinical sign-off
   status" section listing each one.

## What this does NOT do

- Does not derive, propose, or change any actual weight value, bucket threshold, or copy
  string. `needs_clinical_signoff` stays `true` on every file it was already `true` on.
- Does not touch `packages/scoring-engine/src/buckets.ts`'s thresholds — the issue's own
  "done" criteria calls for "an explicit advisor pass," which needs a human clinician. Logged
  as still-open in `docs/clinical-review/content-gaps.md` §1.
- Does not add a `NODE_ENV=production` value anywhere in this repo's own scripts/config —
  the gate is inert until a real deployment sets it, by design.

## Sign-off status

Not clinical content — see CLAUDE.md §9's carve-out for "pure engineering changes (refactors,
infra, non-content bug fixes)." Logged here anyway, matching the precedent set by the
similarly content-free issue #127 entry, so the review trail explains why a boot gate
appeared with no accompanying content change.
