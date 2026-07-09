# 2026-07-08 — Disclaimer wording: which variant is canonical (issue #51)

**Content version:** none — no user-facing copy changed
**Status:** ⛔ awaiting advisor confirmation (documentation decision, not a copy change)

## What issue #51 found

The on-screen disclaimer reads:

> "This is a screening tool, not a diagnosis. Only a qualified professional
> (paediatrician, psychologist, or developmental specialist) can diagnose autism."

while CLAUDE.md §2 rule 5 quoted a shorter form without the parenthetical, so the
on-screen copy looked like an unreviewed extension of approved wording.

## What we established

The product plan itself contains BOTH variants:

- **§3.2** (the screen-disclaimer requirement, and the section CLAUDE.md §6 explicitly
  names as the verbatim source for `<ScreeningDisclaimer />`): **WITH** the parenthetical.
- **§9.3** (the results-summary LLM prompt template): **WITHOUT** the parenthetical.

The shipped constant (`SCREENING_DISCLAIMER` in `packages/shared-types`), the content file,
and every screen match §3.2 exactly — enforced by `validateContent()` and component tests.
So the app was already correct per its designated source; the defect was CLAUDE.md's
abbreviated quote.

## What changed

CLAUDE.md §2 rule 5 now quotes the §3.2 sentence verbatim and names §3.2 as the single
source of truth for the on-screen sentence (§9.3's short form noted as the LLM-prompt
variant). **No app copy, content JSON, or constants changed.**

## For the advisor

Confirm that §3.2 (with the parenthetical) is the reviewed/approved on-screen wording, and
whether §9.3's prompt template should be aligned to it. If the SHORT form is actually the
approved one, the fix is instead a copy change to `SCREENING_DISCLAIMER` +
`result-copy/labels.json` — flag it and we'll do that under this gate.
