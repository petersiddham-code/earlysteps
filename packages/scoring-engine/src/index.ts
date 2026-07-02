/**
 * @earlysteps/scoring-engine — deterministic, rule-based scoring (CLAUDE.md §7).
 * The LLM may explain these outputs; it may never invent or override them.
 */
export * from './buckets.js';
export * from './dedupe.js';
export * from './scoreDomain.js';
export * from './confidence.js';
export * from './supportLevel.js';
export * from './redFlags.js';
export * from './recompute.js';
export * from './recommendationTier.js';
