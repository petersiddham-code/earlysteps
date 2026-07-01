# @earlysteps/backend (placeholder)

Node.js + NestJS API with Prisma over PostgreSQL (CLAUDE.md §3, product plan §6, §7).
**Not implemented in the foundation phase.**

When scaffolded, it wires the intake → scoring → results pipeline: it consumes
`@earlysteps/scoring-engine` (deterministic `recompute()`), persists the §7 data model via
Prisma, and calls the LLM using the templates in `src/ai/prompts/` (guardrail-prepended).
Integration tests must cover at least one red-flag case and one low-signal case (CLAUDE.md §10).
