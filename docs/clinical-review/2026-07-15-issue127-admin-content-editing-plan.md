# Admin Console content editing — inventory, risk tiers, and draft-only workflow (issue #127)

**Date:** 2026-07-15
**Content changed:** none. This PR ships no new question wording, label, red-flag copy, or
threshold value — it adds the *capability* to propose edits to a subset of existing content
as reviewable drafts. Every string currently shipped is unchanged.

## What was asked

Issue #127: "Operation dashboard should allow to edit the content; please plan and explore on
all the values that can be edited and propose and plan." PR #126 (Admin Console v1) shipped
the console read-only on purpose, noting that real editing "would need the CLAUDE.md §9
clinical-review gate wired into the console workflow itself, not just this PR." This is that
follow-up.

Two scope decisions were confirmed with the user before implementation (see conversation):

1. Ship a written proposal **plus** a working first slice, not the full surface area in one PR.
2. Editing is **draft-only**. An admin's edit is stored as a proposal; nothing the console does
   ever writes `packages/content` or changes what a family sees. Publishing still means a
   maintainer turns an approved draft into a normal PR, through CI, with a
   `docs/clinical-review/` sign-off entry — exactly the process this repo already uses for
   every other content change.

## Full content inventory and risk tiers

Everything under `packages/content` was reviewed. Three tiers emerged:

### Tier 1 — never admin-editable (code + PR only)

| File | Why |
|---|---|
| `weights/domain-weights.json` | Scoring weights. CLAUDE.md §7: "Don't change these thresholds without an explicit clinical-review sign-off" — this applies to the numbers themselves, not just the process around them. A UI that lets anyone nudge a weight is the wrong shape for a value that needs domain-expert derivation, not admin judgment. |
| `thresholds/evidence-floors.json` | Same §7 sentence, same reasoning — these gate whether a family sees a result at all. |

Both stay exactly as they are today: hand-edited, PR-reviewed, sign-off logged.

### Tier 2 — structural fields, locked everywhere they appear

Regardless of which file they're in, these are never offered as an editable field, because
code elsewhere keys off their exact value:

- Any `id` (question ids, follow-up ids, resource ids, urgent-resource ids) — scoring weights
  and red-flag rules reference these by id (`validateContent.ts` enforces this cross-file).
- `options` (question/follow-up answer choices) — option ids are what the scoring engine and
  red-flag rules actually read; a caregiver-facing option *label* is currently also locked in
  this phase, out of caution, even though only the id is technically load-bearing.
- `domain`, `age_band`, `type`, `collected_at`, `follow_up`, `red_flag_type`, `kind` — wiring
  fields other code paths switch on.
- `disclaimer` (verbatim, CLAUDE.md §2 rule 5), `sign_level_labels.*`, `recommendation_tiers.*`,
  `support_level_terms.*` (the fixed six/three-term vocabulary, CLAUDE.md §2 rules 2–3),
  `insufficient_evidence.label` (checked against `INSUFFICIENT_EVIDENCE_LABEL` and the lint
  script's approved-labels list) — these are checked programmatically elsewhere; drafting a
  different value would only ever be rejected downstream, so it's not offered at all.
- `version`, `locale`, `needs_clinical_signoff`, `note` — file metadata, not caregiver copy.

### Tier 3 — draftable this phase (prose/copy leaves only)

| Content key | What's editable |
|---|---|
| `questions.universal` / `.toddler` / `.preschool` / `.primary` / `.teen` / `.young_adult` | Per question: `text`, `hint` only. |
| `result-copy.labels` | `card_heading`, `insufficient_evidence.explanation` / `.domain_detail` / `.overall_detail`, `red_flag_confidence_note`. |
| `result-copy.red-flag-copy` | `base_message`, `urgent_resource_heading`, `urgent_resource_message`, and per urgent resource: `label`, `description`, `value` (so a deployment can localize crisis-line numbers — the file's own note already flags this as required per-region). |
| `domain-resources` | Per resource: `label`, `description`, `value`, `source`. |
| `follow-ups` | Per follow-up: `text`, `hint` only. |
| `consent.copy` | Per scope: `label`, `explanation`. |
| `ai-results-summary.copy` | `card_heading`, `framing_note`, every `section_headings.*` leaf (these are just heading labels, e.g. "Likelihood", "Support priorities"). |
| `comparison.copy` | `card_heading`, `red_flag_safety_note`, every `statuses.*` and `reasons.*` leaf (the prose sentences — the six reason *codes* themselves are structural and stay locked). |

The boundary isn't hand-maintained per field: `apps/backend/src/admin/admin-content-registry.ts`
recursively walks each file's live, parsed content and yields every string leaf whose field
name (or, for a couple of specific values, whose exact path) isn't on the lock list above. New
fields added to any of these files in the future are draftable or locked automatically, by the
same rule, without this registry needing an update — the lock list only needs a new entry when
a *new kind* of structural/fixed field is introduced, not when existing files grow.

## Why draft-only, not live-with-a-flag

The alternative considered was: let an edit take effect immediately and flip
`needs_clinical_signoff` back to `true`, relying on the existing review-log surfacing to catch
it after the fact. Rejected — that's the exact failure mode CLAUDE.md §9 exists to prevent:
unreviewed clinical copy reaching real families before a human, let alone an advisor, has seen
it. Nothing about an admin role makes a same-day copy tweak safe to skip review; the gate isn't
about trust in the person, it's about a second set of eyes on wording aimed at a parent worried
about their child's development.

A draft (`ContentDraft` table — `content_key`, `field_path`, `current_value`, `proposed_value`,
`note`, `created_by`, `status`) is purely a proposal. Nothing in the app reads this table to
render anything a family sees. Going live is unchanged from today: someone turns the approved
draft into a real `packages/content` JSON edit, opens a PR, and CI runs
`lint:content`/`validateContent()`/the full test suite before a `docs/clinical-review/` entry
records the sign-off — the same gate a hand-edit of the JSON goes through.

Two more fail-closed checks happen at draft-creation time, before a proposal is even saved,
so obviously-bad drafts don't pile up waiting for a reviewer to catch them:

- `field_path` must currently appear in the registry's live field list for that content key
  (400 otherwise) — a client can't draft an edit to a field the registry doesn't expose, even
  if it guesses a plausible-looking path.
- The proposed text is run through `containsBannedOrReservedLanguage()` (the same banned-word +
  fixed-vocabulary check `scripts/lint-content.mjs` runs over shipped content) — a draft
  containing a banned word or accidentally reproducing the fixed result vocabulary is rejected
  outright (CLAUDE.md §8: "parse defensively and fail closed").

## What's NOT in this PR

- No "approve"/"publish" button anywhere — intentionally. Publishing is a PR, not a console
  action, so there's nothing to build here beyond drafting and discarding.
- No editing of `weights/domain-weights.json` or `thresholds/evidence-floors.json` (Tier 1
  above) — stays code+PR-only, unconditionally, in any future phase too, unless a separate
  clinically-reviewed decision changes that.
- No editing of option labels, even though only option *ids* are technically load-bearing —
  deferred out of caution rather than a proven need; worth revisiting once there's a concrete
  localization or wording-tuning use case for them.
- No bespoke per-field-type editors (e.g. a red-flag-copy-specific layout distinguishing the
  crisis-resource block from the base message). The mobile UI is one generic
  field-list-with-inline-editor screen reused for every content key. A future pass could give
  the highest-traffic content keys (question banks, result-copy) a more tailored editing
  experience if the generic list proves unwieldy in practice.

## Sign-off status

Signed off by Peter Siddham, 2026-07-15 — see `docs/clinical-review/README.md`'s sign-off log.
Both the risk-tiering above (what's locked vs. draftable) and the draft-only workflow itself
were approved as designed.
