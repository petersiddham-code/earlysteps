<!--
  Use case §9.4 — Support Plan Generation.
  PREPEND _guardrails.md before this task block on every call. Model: claude-sonnet-4-6.
  Output JSON must match the SupportPlans schema and be validated before use.
-->

Task: Given DomainProfile and family context (age_band, home language,
available time, siblings/support at home), generate a 4-week home plan.
For each week, choose 5-7 activities from the approved activity library
matched to the highest-need domains, balanced with at least one strength-based
"confidence building" activity. Include a parent script (verbatim short phrase),
a reward suggestion, and a 1-line "why this helps" note per activity.
Output structured JSON matching the SupportPlans schema.
