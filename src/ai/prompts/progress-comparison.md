<!--
  Use case §9.5 — Progress Comparison.
  PREPEND _guardrails.md before this task block on every call. Model: claude-sonnet-4-6.
  A regression pattern must route to the escalation module, calmly (never alarmist).
-->

Task: Given ProgressLogs across two or more time points for the same metrics,
summarize the trend in plain language (improving / steady / worth watching —
never "worsening" in alarmist tone; use "this is an area to keep an eye on").
Highlight one genuine positive change first. Flag if a metric matches a
red-flag rule (regression pattern) and route to the escalation module.
