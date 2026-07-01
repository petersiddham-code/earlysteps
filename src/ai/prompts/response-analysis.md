<!--
  Use case §9.2 — Child Response Analysis.
  PREPEND _guardrails.md before this task block on every call. Model: claude-sonnet-4-6.
  Output JSON must be schema-validated before use; the model must NOT assign scores.
-->

Task: Given one child activity result (age_band, activity_type, raw response
data), extract structured indicators relevant to domain: [domain].
Output JSON: {indicators: [{indicator_id, present: bool, evidence_quote}],
notes: plain-language 1-sentence observation using approved vocabulary}.
Do not assign a score yourself — scoring is handled by the deterministic engine.
