# 2026-07-02 — Free-text response analysis: confirmation follow-ups + red-flag rule extension (issue #26)

**Status: ⛔ awaiting advisor sign-off. Clinical content change — needs advisor sign-off before any release.**

## Why

Caregiver free-text answers (the optional "add anything else, in your own words" boxes) were
stored and reflected back in Strengths, but contributed **nothing** to domain scores,
confidence, or red flags — the scoring engine weighs unknown entries as 0 and red-flag rules
compare exact option ids. That hid serious signal: a caregiver typing *"he stopped speaking
last month"* is describing loss of previously-acquired skills — a hard-coded red flag — and
the engine never saw it.

## What changed (design summary)

Deterministic-first, LLM-assists (CLAUDE.md §2 rule 7): the deterministic scoring pass is
unchanged and never waits on the LLM. A new backend stage — gated on the `ai_analysis`
consent scope, PII-minimized (question text + the single typed answer only), schema-validated
and fail-closed — asks the model whether a typed note describes one of the eight hard-coded
red-flag types. A recognized signal only ever surfaces a **content-authored confirmation
question** to the caregiver ("has [child] lost words or skills they used to have?" —
yes / no / I'm not sure). Only the caregiver's own structured answer enters the deterministic
engine, as a normal IntakeResponse. The LLM proposes; the caregiver confirms; the rules decide.

## Clinical content requiring review

1. **Follow-up question wordings** — `packages/content/follow-ups/follow-ups.json`
   (version 1.0.0, `needs_clinical_signoff: true`). Eight newly authored confirmation
   questions, one per red-flag type, each with a reassuring hint and yes/no/not_sure options.
   Written to be calm, non-leading, and to make clear the caregiver's answer (not our reading
   of their note) is what counts. **Every wording is new copy that needs advisor review.**
2. **Signal → red-flag mapping** — each follow-up carries `red_flag_type`; a confirmed "yes"
   on `FU_<type>` triggers exactly that deterministic rule. The mapping is 1:1 and enumerable
   in the same JSON file.
3. **Red-flag trigger definition extension** — `packages/scoring-engine/src/redFlags.ts`:
   every rule now additionally triggers on its `FU_<type>` question answered `yes`
   (`checkFollowUpConfirmed`). Base triggers are unchanged; `no` / `not_sure` contribute
   nothing; free-text echoes can never trigger. This widens each rule's trigger set and is a
   red-flag trigger definition change under CLAUDE.md §9.
4. **Response-analysis prompt** — `src/ai/prompts/response-analysis.md` rewritten for the
   free-text use case (previously an unwired activity-analysis sketch). It prepends the shared
   guardrail block, forbids scoring/diagnosis by the model, restricts output to the closed
   red-flag/domain vocabularies, and demands verbatim evidence quotes.

## Deliberate limits (not oversights)

- One confirmation per follow-up per child, ever — repeat mentions never re-open an
  already-answered question (no nagging; a "no" is respected).
- Domain-only signals (no red-flag type) are validated then dropped — no weighted-scoring
  path exists for them yet; see content-gaps.md item 9.
- Malformed/unavailable model output contributes nothing; without `ai_analysis` consent the
  stage never runs and results are unaffected.

## Reviewer checklist

- [ ] Each of the eight follow-up wordings + hints (tone, clinical accuracy, non-leading).
- [ ] The 1:1 signal→red-flag mapping.
- [ ] The rule extension: is "caregiver-confirmed yes on a follow-up" an acceptable trigger
      for each of the eight types?
- [ ] The prompt's framing of the eight red-flag descriptions shown to the model.

| Field | Value |
|---|---|
| Content version | follow-ups 1.0.0; questions unchanged; weights unchanged |
| Advisor | _pending_ |
| Sign-off | ⛔ not signed off |
