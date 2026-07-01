<!--
  Use case §9.1 — Parent Questionnaire Generation.
  PREPEND _guardrails.md before this task block on every call. Model: claude-sonnet-4-6.
  Output must be validated against the Question schema before use; fail closed on invalid JSON.
-->

Task: Given the child's age_band and any prior answers, select/adapt the next
3-5 intake questions from the approved question bank for [age_band] covering
domains not yet sufficiently answered: [list of under-covered domains].
Phrase each question in warm, concrete, example-based parent language
(e.g., "Does [child] point to show you something interesting, like a bird or a
plane?"). Output as JSON: [{id, domain, text, response_type}].
Do not introduce new clinical criteria not present in the approved bank.
