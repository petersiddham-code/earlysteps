# Feeding & sleep domain-mapping — scope decision

**Status:** RESOLVED 2026-07-13 — keep the mapping as-is (Option A). No question wording,
weight, threshold, or red-flag logic changed. See Resolution at the bottom.

## The question

Ten questions across the five age bands exist primarily to drive two red-flag rules —
`checkSevereFeeding` (`T14`/`P16`/`PR23`/`TE21`/`YA23`) and `checkSevereSleep`
(`T15`/`P21`/`PR17`/`TE14`/`YA12`), both in `packages/scoring-engine/src/redFlags.ts`. Every
one of them is also tagged `"domain": "sensory"` (feeding) or `"domain": "emotional_regulation"`
(sleep) in its question bank JSON, and has a live entry in
`packages/content/weights/domain-weights.json` — so the same answer both feeds a red-flag
check AND contributes weighted evidence toward a caregiver-visible sensory/emotional_regulation
traffic-light level. Is that mapping clinically defensible, or should these ten questions be
pulled out of domain scoring entirely?

## Why this is a live question, not settled

The eight OTHER universal red-flag-only questions (`RF_loss_of_skills`, `RF_self_injury`,
`RF_sudden_behaviour_change`, `RF_safety_concern`, plus the toddler/preschool-only proxy
questions `T4`/`P5`/`T2`/`T3`/`P1`) are **not** treated the same way. Checked directly against
the shipped content:

```
RF_loss_of_skills          -> domain: "profile"   (no weights-table entry — excluded from scoring)
RF_self_injury             -> domain: "profile"   (no weights-table entry — excluded from scoring)
RF_sudden_behaviour_change -> domain: "profile"   (no weights-table entry — excluded from scoring)
RF_safety_concern          -> domain: "profile"   (no weights-table entry — excluded from scoring)

T14 (feeding)  -> domain: "sensory"              -> weighted indicator, scores sensory
T15 (sleep)    -> domain: "emotional_regulation" -> weighted indicator, scores emotional_regulation
... (same pattern for P16/P21, PR23/PR17, TE21/TE14, YA23/YA12)
```

`IntakeResponse.domain` already supports a non-scored `'profile'` value precisely for
questions that should drive red-flag logic without also counting toward a `DomainFinding`
(`packages/scoring-engine/src/scoreDomain.ts` only scores a question if
`INDICATORS_BY_QUESTION` has an entry for it, and `'profile'`-tagged questions never get one —
see `packages/content/src/weights.ts`). Feeding and sleep are the only two red-flag-driving
question families that break that pattern. That could be intentional (feeding/sleep do have
real, if partial, sensory- and regulation-adjacent constructs in the clinical literature — food
texture/taste sensitivity is a recognized sensory-processing signal; sleep disruption
correlates with dysregulation) — or it could be an unreviewed default that's never actually
been evaluated, which is exactly what the original content-gaps.md §3 entry flagged.

## Concrete stakes if the mapping stays as-is

A caregiver whose child eats a narrow range of foods for reasons unrelated to sensory
processing (a picky-eating phase, a health condition, a preference) will see that answer pull
the `sensory` domain's traffic-light level upward — a domain the caregiver may otherwise see
zero other signal in. Same shape of risk for sleep pulling `emotional_regulation`. Because
`checkSevereFeeding`/`checkSevereSleep` are gate-exempt (CLAUDE.md §2 rule 8), the red-flag
path already works correctly and calmly regardless of this decision — what's actually at stake
is only whether these ten questions' *lower-severity* answers ("somewhat picky," "some
difficulty falling/staying asleep") should keep nudging a domain level the caregiver reads as
autism-related social/sensory/regulation signal.

## Options

**A — Keep the mapping as-is.** No engine change. Requires an advisor confirming
food-texture/taste sensitivity and sleep disruption are appropriately captured under
`sensory`/`emotional_regulation` specifically (not just "somewhere in the nine domains").

**B — Match the other red-flag-only questions: retag all ten `domain: "profile"`.** Removes
them from `domain-weights.json`'s indicator table entirely (a placeholder-weight change,
still needs the clinical-content gate, but net-negative — nothing new to weight). They'd
continue driving `checkSevereFeeding`/`checkSevereSleep` exactly as today (those rules read
raw `IntakeResponse[]` by question id, never the computed `DomainProfile`). Matches the
pattern every other red-flag-only question already follows; smallest engineering change of
the three options.

**C — Introduce a dedicated non-domain bucket** (e.g. surfaced as an evidence note rather
than folded into an existing traffic light) if an advisor believes feeding/sleep concerns
deserve their own visible signal distinct from both "profile-only, invisible" (B) and "counts
toward an existing domain" (A). Largest lift — needs product-plan-level scope agreement
before any engineering starts, since it would add a caregiver-facing concept beyond the nine
`DomainProfile` domains product plan §7 currently defines.

## Resolution — 2026-07-13, Option A (keep the mapping as-is)

Before acting on this note's non-binding lean toward Option B, checked what retagging all
ten questions `domain: "profile"` would actually do to the per-band evidence-floor coverage
that content-gaps.md §10 spent many batches closing:

```
sensory, per band:              toddler 4, preschool 3, primary 4, teen 4, young_adult 4
emotional_regulation, per band: toddler 3, preschool 3, primary 3, teen 3, young_adult 3
```

Sleep is exactly 1 of only 3 `emotional_regulation` items in **every** band (the other two
per band — T25/T26, P25/P26, PR13/PR22, TE7/TE8, YA8/YA9 — were authored specifically to
reach the floor by issues #65/#82). Removing it drops `emotional_regulation` to 2 items,
below the 3-item floor, in all five bands simultaneously. Feeding does the same to
`sensory` in preschool specifically (P16 is 1 of only P15/P16/P22).

So Option B is not the "smallest change" this note originally framed it as — done properly,
it requires authoring six new placeholder-weighted questions (one per band for
`emotional_regulation`, one more for preschool `sensory`) to avoid silently reopening gaps
that issues #65, #78, #82, TE14, and YA12 already closed. That's a full content-authoring
batch, not a scope-decision-sized change, and trading a mapping-consistency cleanup for a
real coverage regression (or a disproportionate authoring lift to avoid one) isn't a good
trade.

**Decision: keep the current mapping (Option A).** Feeding and sleep stay scored under
`sensory`/`emotional_regulation` respectively, and continue driving
`checkSevereFeeding`/`checkSevereSleep` exactly as today — those rules are unaffected by
this decision either way (gate-exempt per CLAUDE.md §2 rule 8, read raw answers by question
id, never the computed domain profile). The original inconsistency this note opened with
(feeding/sleep being the only red-flag-driving questions that also score a domain) is a real
observation, but resolving it costs more (new clinical content, an authoring batch) than the
inconsistency itself costs (feeding/sleep already have a defensible partial basis under
sensory/emotional_regulation, and the caregiver-facing behavior — a nudge to those two
traffic lights from a picky-eating or sleep-disruption answer — is a modest, not clearly
wrong, effect). Revisit if an advisor specifically flags the sensory/emotional_regulation
framing as clinically incorrect, at which point authoring the six replacement questions
becomes the right call, not just cleanup.

Closes issue #120, no clinical content shipped — signed off by Peter Siddham.
