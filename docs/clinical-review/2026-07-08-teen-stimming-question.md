# 2026-07-08 — Teen band: repetitive-movement/speech (stimming) question (issue #54)

**Content version:** questions teen 1.2.0 / weights 0.3.0-placeholder
**Status:** ⛔ awaiting advisor sign-off

## What changed and why

Issue #54 (S2) found the Teen (13–18y) band covered intense interests (TE4), routine
changes (TE5), and sensory reactions (TE6) but had **no explicit repetitive-movement or
repetitive-speech item** — unlike Toddler (T10) and Preschool (P12). Repetitive
movements/speech persist into adolescence (often masked in public, more visible at home)
and are a core DSM-5-TR/ICD-11 restricted-repetitive-behaviour indicator, so this was a
genuine coverage gap, not an age-appropriate simplification.

**New question TE13** (inserted after TE5 so the repetitive/self-regulating cluster reads
together), newly authored, wording our own:

> "Does [child] have movements or sounds they repeat — like rocking, pacing, hand or
> finger movements, or repeating words and phrases from shows or conversations?"

- Type: `chip_multi_select` (mirrors T10's structure): Rocking or pacing / Hand or finger
  movements / Repeating words, phrases, or scripts / Humming or other repeated sounds /
  Something else / None I've noticed.
- Hint (masking-aware, per the tone of TE10): "Many teens keep these private and relax
  into them at home — what you notice at home counts too."
- `allow_free_text: true` — same rationale as the six sensory questions enabled on
  2026-07-02: caregivers often describe specific scripts/movements in their own words.

**Placeholder weight** added (sum, 5 per selected behaviour, mirroring T10's placeholder
pattern; "None I've noticed" unweighted) — same NOT-CLINICALLY-VALIDATED status as every
other weight in `domain-weights.json`.

## For the advisor

- Question wording, option list, and hint (newly authored; constructs align with
  SCQ/AQ/CAT-Q repetitive-behaviour items, wording NOT copied).
- Whether echolalia/scripting should be a separate item from motor stimming.
- Placeholder weight values, as with all weights.
