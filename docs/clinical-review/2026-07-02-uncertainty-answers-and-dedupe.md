# 2026-07-02 — Scoring behaviour change: uncertainty answers + repeated-answer dedupe

**Status: needs advisor sign-off** (scoring behaviour change, CLAUDE.md §9).
No weights, bucket thresholds, question wording, or red-flag trigger definitions changed.

## 1. "Not sure" / "Prefer not to say" answers are no longer scored as reassuring

**What changed:** `scoreDomains()` now skips answers whose selected option id is in
`UNCERTAINTY_OPTION_IDS` (`not_sure`, `prefer_not_to_say`, defined in
`packages/shared-types/src/vocabulary.ts`). For multi-selects, uncertainty ids are filtered
out of the selection; if nothing remains, the question is treated as unanswered. Skipped
answers no longer count toward `answeredCount`, so they no longer raise
confidence/completeness either. Content validation now rejects any weight assigned to an
uncertainty option id, so this exclusion can never silently hide a weighted answer.

**Why:** previously an uncertainty answer contributed 0 to the numerator but the question's
full max to the denominator — mathematically identical to the *most reassuring* possible
answer — and incremented the answered count. A caregiver answering "Not sure" to everything
received "Low signs observed" across all domains at medium confidence. That contradicts
product plan §4.1b ("I'm not sure is always an option, never a trap"): uncertainty is a gap
in evidence, not evidence of typical development. After the change, an all-"not sure" intake
produces no domain findings and no support estimate rather than a falsely reassuring result.

**For advisor review:** confirm that treating uncertainty as missing data (rather than, e.g.,
a prompt for a follow-up question or an observation activity) is the clinically right
interpretation, and confirm the id list is complete for future content.

## 2. Repeated answers to the same question are deduped — latest wins

**What changed:** `recompute()` now dedupes its input by `question_id`, keeping only the
response with the latest timestamp (ties resolve to persistence order), before domain scoring
and red-flag evaluation. Closes content-gaps.md item 7.

**Why:** scoring always runs against the child's full answer history; a re-answered question
previously contributed twice to the domain score, and red-flag rules (which take the *first*
match) could act on a stale superseded answer. Only the caregiver's current answer is
evidence. Note the deliberate consequence for red flags: a flag triggered by an earlier
answer will no longer re-trigger on future recomputes if the caregiver later changes that
answer — the earlier triggered `RedFlagRecord` rows remain in history (records are
append-only, never overwritten).

**For advisor review:** confirm "latest answer wins" is the right rule, including for
red-flag questions (vs. e.g. "once concerning, always surface until a professional resolves
it" — which the persisted, append-only red-flag history still supports at the product level).

## Sign-off

| Date | What changed | Advisor | Status |
|---|---|---|---|
| 2026-07-02 | Uncertainty answers excluded from scoring + confidence; recompute dedupes by question_id (latest wins) | _pending_ | ⛔ awaiting sign-off |
