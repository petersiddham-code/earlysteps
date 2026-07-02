# 2026-07-02 — Question-bank professional alignment (issue #18)

**Status: ⛔ awaiting advisor sign-off. Clinical content change — question wording, a
red-flag trigger definition, and placeholder weights all changed.**

Issue #18 asks that the caregiver question list be "as close as any professional person
asked question" — many target families have no access to a paediatric developmental
specialist, so the intake must cover what a professional screening interview covers. This
change closes the documented gaps against the constructs probed by validated screening
instruments. **Constructs only, in our own low-literacy wording — no item text was copied
from any copyrighted instrument (M-CHAT-R/F™, SCQ, AQ, SRS-2).**

## 1. Red-flag questions authored — rules now LIVE (closes content-gaps.md item 2)

The four §4.8 red-flag rules that keyed off placeholder ids were inert on real data because
no bank asked the question. The questions now exist in the **universal bank** (asked for
every age band, all versions bumped to 1.1.0), with ids exactly matching the engine's
existing constants — the rules went live with no engine change:

| Question id | Trigger construct | Wording approach |
|---|---|---|
| `RF_loss_of_skills` | Regression — loss of previously-acquired words/skills (highest-weight NICE signal) | "lost skills they once had", concrete examples, calm hint |
| `RF_self_injury` | Self-injury risk indicators | Direct but non-judgmental ("hard question — an honest answer helps") |
| `RF_sudden_behaviour_change` | Sudden significant behaviour change | Anchored to "last few weeks or months", distinguishes from everyday ups and downs |
| `RF_safety_concern` | Day-to-day safety risk (elopement, no danger awareness) | Normalising hint ("many families manage safety worries") |

All four: `domain: "profile"` — **deliberately structurally unweightable** (the weights
schema only accepts real scoring domains), so a red-flag answer can only ever reach the
independent red-flag rules and can never be averaged into a domain score (CLAUDE.md §2
rule 8). All four trigger on option id `yes` only; `not_sure` never triggers; free-text
notes are namespaced and can never trigger (existing engine behaviour, tested).

New test `packages/scoring-engine/src/redFlagContentWiring.test.ts` pins every rule's
question ids and trigger option ids to the shipped banks, so a content rename can never
silently turn a rule inert again.

## 2. Severe-feeding trigger redefined (red-flag trigger definition change — review closely)

content-gaps.md item 2 flagged "very picky" as a **weak proxy** for §4.8's "severe
feeding/growth concern". Ordinary picky eating is extremely common in toddlers/preschoolers
and a professional would not escalate on it alone.

- T14/P16 gain an explicit option: **"So few foods I worry about their growth or health"**
  (`so_few_worried_growth`).
- `checkSevereFeeding` now triggers **only** on that option. `very_picky` no longer
  escalates — it remains a weighted sensory-domain signal (weight unchanged at 8; the new
  option weighs 10).
- Net effect: fewer false-positive escalations; the escalation that remains is
  caregiver-reported growth/health worry, which is unambiguously §4.8 "severe".

## 3. New screening-construct questions (all newly authored — need full wording review)

Thirteen scored questions fill constructs a professional would probe but the banks did not.
Instrument column = the validated instrument whose construct this mirrors (not whose text).

| Id | Band | Domain | Construct | Instrument analogue |
|---|---|---|---|---|
| T17 | toddler | social | Gaze following / responding to joint attention | M-CHAT-R |
| T18 | toddler | social | Interest in other children | M-CHAT-R |
| T19 | toddler | communication | Receptive language without gesture cues | CDC milestones / CSBS |
| T20 | toddler | sensory | Unusual visual inspection (close-up, side-eye, spinning) | M-CHAT-R |
| T21 | toddler | social | Comfort-seeking when hurt/upset | M-CHAT-R / CSBS |
| P19 | preschool | communication | Two-step instruction (receptive) | ASQ-3 / CDC milestones |
| P20 | preschool | communication | Atypical prosody (flat, sing-song, robot-like) | SCQ |
| PR15 | primary | repetitive_behaviour | Reaction to unexpected change (distinct from routine-sameness PR8) | SRS-2 / SCQ |
| PR16 | primary | social | Integrated nonverbal communication (gesture + facial expression) | ADI-R construct / SCQ |
| TE10 | teen | social | Camouflaging/masking → social exhaustion | CAT-Q construct |
| TE11 | teen | communication | Literal language understanding (was only asked for primary/YA) | AQ-Adolescent |
| TE12 | teen | learning | School-raised concerns (teen band had no school question) | Standard clinical intake |
| YA11 | young_adult | social | Camouflaging/masking → recovery need | CAT-Q construct |

The teen bank was the thinnest (9 questions) and gets the most additions; masking is the
construct professionals specifically probe in adolescents/young adults, especially for
presentations historically missed by child-focused instruments.

## 4. Weights (still placeholder — sign-off blocker unchanged)

`domain-weights.json` bumped to `0.2.0-placeholder`, `needs_clinical_signoff: true`
unchanged. New indicators follow the existing placeholder scale (strong sign 8–10 /
moderate 3–5); uncertainty options are never weighted (enforced by validateContent).
These numbers remain non-validated placeholders, same as every existing weight.

## 5. Still open (not closed by this change)

- Weights and bucket thresholds remain placeholders (content-gaps.md item 1).
- Teen/young-adult **self-report** flows still deferred (caregiver-report only).
- Severe-sleep proxy (T15 `significant_struggles`) unchanged — review whether it meets the
  "severe" bar.
- No name-response / functional-communication proxies still toddler+preschool only; for
  primary/teen/YA these early-childhood signs are age-inappropriate to ask directly, but an
  advisor should confirm no band-appropriate equivalent is needed.

## Sign-off checklist for the advisor

- [ ] Wording of the four RF_* questions (especially `RF_self_injury` tone)
- [ ] Severe-feeding trigger redefinition (§2 above — a rule now fires on fewer answers)
- [ ] Wording + option scales of the 13 new questions
- [ ] Placeholder weights for the new indicators
- [ ] Confirmation that construct paraphrases stay clear of instrument copyright
