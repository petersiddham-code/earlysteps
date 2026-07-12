# Issue #66 coverage audit — expert-aligned intake

Issue #66 is a roadmap item, not a single bug: "DSM-based coverage in every age band,
red flags run everywhere applicable, confidence never omitted, safe language everywhere,
strengths-first results, layered consent, references + sign-off trail." Its three
originally-linked sub-issues (#63 forced storage opt-in, #64 missing confidence, #65
missing severe-sleep red flag) are already closed. This document checks the current
codebase against #66's four acceptance criteria, using `content-gaps.md` — which already
tracks nearly all of this in detail across ~20 prior issues (#65, #78–#92, #104) — as the
source of truth, and calls out what's genuinely new.

## 1. "All age bands pass a coverage checklist"

`content-gaps.md` §10 keeps a live per-band/per-domain evidence-floor matrix. Re-verified
against the shipped question banks today:

- 7 of 9 domains are at or above the 3-item floor in every band that asks them (social,
  communication, sensory, repetitive_behaviour, attention, emotional_regulation, and —
  as of #92 — learning for young_adult).
- Still below floor (tracked, open, unaddressed — content-gaps.md §10 "remain open"):
  learning (preschool 1, primary 1, teen 1) and daily_living (primary 1, teen 1,
  young_adult 1). Re-counted directly against the shipped JSON; matches the tracked state
  exactly.
- learning (toddler) and daily_living (toddler, preschool) are confirmed-intentional
  omissions (issue #83) — too early for those constructs to be meaningful signals.
- **New finding, not previously tracked: the `motor` domain (`DomainProfile`'s ninth
  domain, `packages/shared-types/src/domains.ts`) has zero question coverage in any age
  band.** No `T*`/`P*`/`PR*`/`TE*`/`YA*` question anywhere carries `"domain": "motor"` —
  confirmed by scanning every question bank. `domain-resources.json` already has a motor
  support-resource entry (issue #71), implying the domain was meant to be reachable, but
  nothing in the intake can ever produce a motor `DomainFinding`. Filed as **issue #109**
  rather than authored here — new question wording needs the same clinical-review gate as
  every other coverage batch in content-gaps.md §10.

## 2. "All red flag rules run for every applicable age band"

All eight `RED_FLAG_TYPES` are evaluated on every intake (`RED_FLAG_RULES`,
`redFlags.ts`), and `redFlagContentWiring.test.ts` pins every rule to real shipped
question/option ids so a content rename can't silently make a rule inert. Per-rule
band reach, re-verified against the current banks:

- `loss_of_skills`, `self_injury_risk`, `sudden_behaviour_change`, `safety_risk` — asked
  in the universal bank, so all five bands. ✅
- `severe_sleep` — one question per band (T15/P21/PR17/TE14/YA12), closed by issue #65.
  All five bands. ✅
- `no_name_response`, `no_functional_communication` — toddler/preschool only, **by
  design**, per content-gaps.md §4: "early-childhood signs; an advisor should confirm no
  band-appropriate equivalent is needed." Still open, still correctly tracked, no code
  change needed here — this is a clinical judgment call, not an engineering gap.
- `severe_feeding` (`checkSevereFeeding`) — checks only `T14` (toddler) and `P16`
  (preschool). **New finding: this is the same structural gap class issue #65 fixed for
  sleep, and it is not yet flagged as an open band-coverage item anywhere.**
  content-gaps.md §3 only questions the domain *mapping* ("feeding... don't correspond to
  one of the nine DomainProfile domains... confirm this mapping"), not the fact that
  primary/teen/young_adult have no feeding/eating question at all, so
  `checkSevereFeeding` can structurally never fire for those three bands. Filed as
  **issue #110**, mirroring #65's precedent exactly — same fix shape (one question per
  remaining band, `checkSevereFeeding` extended to check all five ids), same
  clinical-review gate.

## 3. "Confidence cannot be omitted or 'assumed' when evidence is weak"

Enforced structurally, not just by convention:

- `computeConfidence` (`packages/scoring-engine/src/confidence.ts`) caps at `'low'`
  whenever `answeredCount < MIN_ANSWERS_FOR_MEDIUM` or completeness is below
  `LOW_COMPLETENESS` — sparse data can never read as medium/high confidence regardless of
  how the score looks.
- `TrafficLightBarProps` (`apps/mobile/src/components/TrafficLightBar/TrafficLightBar.tsx`)
  is a discriminated union: a real `SignLevel` **requires** a `confidence` field at the
  type level, and the `insufficient_evidence` branch carries no level/confidence at all —
  there's no code path through which a level can render without confidence, or a
  from-nothing level can render at all.
- `ResultsView.recommendationConfidence` (issue #64) travels 1:1 with
  `recommendationTier` — the type makes "tier present, confidence absent" and vice versa
  unrepresentable.
- `ResultsView.insufficientEvidenceOverall` / minimum-evidence gate (issue #22): below
  the evidence floor, the "Not enough information yet" state — which explicitly states
  `Confidence: low` — replaces the domain/support/recommendation fields rather than
  guessing.
- Assessment B (dual-assessment architecture, issue #104) reports its own non-optional
  `confidence` field per §13's schema, separate from Assessment A's, per
  `2026-07-11-dual-assessment-architecture.md`.

No gap found here. content-gaps.md §11 already notes the one caveat: this convention only
exists on the mobile Results screen today — no web/PDF/chatbot surface exists yet to
extend it to.

## 4. "Disclaimers + safe language verified across results surfaces"

- `pnpm lint:content` (re-run as part of this audit, currently green) scans: banned words
  in all content JSON, off-list result labels, missing guardrail references in LLM
  prompts, banned words in mobile source (string literals and JSX text), and
  `<ScreeningDisclaimer />` presence on every screen matched by `/results|report/i` under
  `apps/mobile/src/screens`. Today that's exactly one file (`ResultsScreen.tsx`), and it
  renders the disclaimer on every branch (error, no-results-yet, and the normal results
  view).
- No web results page, PDF clinician report, or chatbot surface exists yet
  (content-gaps.md §11) — nothing to check there until one is built; whoever builds one
  next inherits this same lint gate automatically (it's a structural filename match, not
  a hand-maintained list).
- No new findings here.

## New gaps filed as follow-up issues

Consistent with how every other item in content-gaps.md §10 shipped — one issue, one
clinically-gated PR, per gap — the two new findings above are **not** authored in this PR:

- **#109** — motor domain has zero question coverage in any age band.
- **#110** — severe-feeding red flag can't fire for primary/teen/young_adult
  (band-coverage gap, same class as #65).

Both are logged as new items in `content-gaps.md` (§12, §13) so they don't get lost, and
`docs/clinical-review/README.md` carries a documentation-only sign-off-log row for this
audit itself (no shipped question wording, weight, threshold, or result copy changed by
this PR — the two gap fixes above will each carry their own row when authored).

## Everything else #66 asked for — already closed, re-confirmed here

- Guest mode / storage-optional consent — issue #63, closed.
- Confidence beside every finding — issue #64, closed.
- Severe-sleep red flag for older bands — issue #65, closed.
- Strengths-before-needs ordering — `<StrengthsFirstList />` / Assessment B strengths
  populated first (CLAUDE.md §2 rules 6/15) — unchanged, still holds.
- "Screening tool, not diagnosis" disclaimer on every result surface — confirmed above.
- No percentages, no normal/abnormal language — enforced by the banned-words lint
  (`abnormal` is on the banned list) and the fixed six-label vocabulary.

## Also noticed, out of scope for this audit, flagged separately

`CLAUDE.md` §16 ("Migration status") still describes `<AIAssessmentCard />`,
`<ComparisonCard />`, `<ConfidenceBadge />`, and `<SupportPrioritiesCard />` as "not yet
built." They shipped 2026-07-11/12 (issue #104, both PRs — see the README log rows dated
2026-07-11 and 2026-07-12). This is a documentation-accuracy fix, not a #66 coverage gap;
corrected in this PR since it was directly encountered while auditing the same files.
