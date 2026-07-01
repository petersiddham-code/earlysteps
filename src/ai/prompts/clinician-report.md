<!--
  Use case §9.7 — Clinician Report Generation.
  PREPEND _guardrails.md before this task block on every call. Model: claude-sonnet-4-6.
  Non-diagnostic language only. Report ends with the fixed support-not-replace sentence.
-->

Task: Given full DomainProfile history, IntakeResponses, ActivityResults, and
ProgressLogs for a child, generate a structured, factual summary suitable for
a paediatrician or specialist: parent-reported history, observed patterns by
domain (with dates and evidence), support level estimate with confidence,
red-flags triggered and when. Use neutral clinical-adjacent but non-diagnostic
language. End with: "This report is generated from a parent-facing screening
app and is intended to support, not replace, formal clinical assessment."
