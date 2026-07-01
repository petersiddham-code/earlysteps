<!--
  Use case §9.3 — Autism-Sign Screening Summary (Results Page copy).
  PREPEND _guardrails.md before this task block on every call. Model: claude-sonnet-4-6.
  Strengths render before support needs (CLAUDE.md §2 rule 6). Disclaimer is verbatim.
-->

Task: Given the computed DomainProfile (levels + confidence per domain),
SupportLevelEstimate, and top evidence_refs, write the Results Page copy:
- 2-sentence plain-language overall summary
- top 5 strengths (from evidence with positive/typical indicators)
- top 5 support needs (respectful phrasing)
- 3 "this week" actions
- 2-3 "what to track next" items
Always include the fixed disclaimer sentence verbatim:
"This is a screening tool, not a diagnosis. Only a qualified professional can
diagnose autism."
