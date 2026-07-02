# 2026-07-02 — Age-band expansion: Primary, Teen, and Young Adult (19–25)

**Status: needs advisor sign-off** — this note covers NEW question content and placeholder
weights (CLAUDE.md §9). The Young Adult section needs the strongest review in this repo.

## What shipped

All three new banks are **caregiver-answered**, consistent with the app's single-respondent
model (explicit product-owner decision, 2026-07-02: ship caregiver-report now, build
self-report flows as a follow-up feature).

### 1. Primary (6–12y) — `questions/primary.json`, PR1–PR14

Extracted **verbatim** from product plan §4.1c-D (text, options, and the three hints the
spec provides: PR7, PR12; TE-style strengths hint on PR8 adapted). The spec leaves most
`hint` fields empty ("—"), but CLAUDE.md §5 requires a hint on every question, so brief
reassuring hints in the established bank style were **authored during extraction** — each
needs wording review.

### 2. Teen (13–18y) — `questions/teen.json`, TE1–TE9 (parent version only)

Extracted verbatim from product plan §4.1c-E's parent version, same authored-hints caveat.
The spec's `[teen]` placeholder is rendered through the same `[child]` nickname token the
rest of the app uses. **The spec's optional teen self-report bank (TS1–TS5) is NOT shipped**
— it requires a self-report flow (respondent selection, teen permission handling) that was
deliberately deferred.

### 3. Young Adult (19–25y) — `questions/young-adult.json`, YA1–YA10 — ⚠️ BEYOND SPEC

The product plan ends at Teen (13–18). This band exists at the product owner's request
("at least until young adult 25 yrs"). **Every question is newly authored** — no spec basis
— mirroring the Teen bank's domain coverage (communication, social, repetitive_behaviour,
sensory, emotional_regulation, daily_living) with adult contexts (work/study routine,
money/appointments, social energy/drain, indirect hints). Authoring choices to review:

- Caregiver-phrased ("Does [name]…"), with hints inviting the young adult to answer
  together with the caregiver. Adult autism screening is normally self-report-first
  (AQ-style); a caregiver-report bank is a pragmatic interim, not the end state.
- YA9 gently touches masking/exhaustion ("exhausted by social expectations") without
  clinical terminology.
- No employment/relationship-outcome questions — kept to observable day-to-day patterns.
- Age overlap: existing bands use developmental ages; 19–25 assumes the caregiver still
  has day-to-day insight. Review whether the band should carry an in-app framing note.

### 4. Placeholder weights for all three banks — `weights/domain-weights.json`

Same status as the existing toddler/preschool weights: **placeholders to exercise the
engine, NOT clinically validated** (`needs_clinical_signoff: true`). Weighting pattern
mirrors the existing banks (most-concerning option 8–10, middle option 3–5, yes-flags 4).

## Known gaps opened/kept by this change

- **No red-flag proxy coverage for the new bands.** The shipped red-flag rules key off
  toddler/preschool question ids (T2/T3/T4/T14/T15, P1/P5/P16); nothing in PR/TE/YA feeds
  them. Regression, self-injury, sudden change, and safety triggers remain inert for ALL
  bands until the RF_* questions are authored (content-gaps.md item 2) — for older ages
  these arguably matter more, not less.
- **No observation activities** for the new bands (product plan §4.2 lists them for
  primary/teen; nothing exists for young adult).
- **Self-report flows** (teen TS1–TS5 + a young-adult equivalent) deferred.

## Sign-off

| Date | What changed | Advisor | Status |
|---|---|---|---|
| 2026-07-02 | Primary + Teen banks (spec-extracted, hints authored), Young Adult bank (fully new, beyond spec), placeholder weights for all three | _pending_ | ⛔ awaiting sign-off — Young Adult especially |
