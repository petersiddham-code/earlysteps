/**
 * Assessment B — the independent AI Assessment Engine's output (issue #104, product plan
 * §9.3, CLAUDE.md §13). v2: brought up to the dual-assessment architecture added to
 * CLAUDE.md on 2026-07-11 (see `docs/clinical-review/2026-07-11-dual-assessment-architecture.md`) —
 * v1 (`overview`/`strengths`/`areasToWatch`/`notedByCaregiver`) predated that spec.
 *
 * Generated purely from the caregiver's raw questionnaire answers — the LLM never sees the
 * deterministic engine's (Assessment A) computed levels, support estimate, recommendation,
 * or red flags (CLAUDE.md §2 rule 7: only the scoring engine ever decides those). This is a
 * second, independent read for the caregiver to compare against the official result, not an
 * explanation of it.
 *
 * §13 also lists "comparison with Assessment A" as part of Assessment B's output schema —
 * that is deliberately NOT a field here. Satisfying it here would mean giving the LLM call
 * Assessment A's data, breaking the isolation this file's whole design exists to preserve.
 * Instead the comparison is a separate, third computation (`@earlysteps/comparison-engine`)
 * that runs after both engines have independently produced their own output — see
 * `ComparisonResult` in `./comparisonResult.js`.
 */
import type { AiLikelihoodLabel, Confidence, UncertaintyFactor } from './vocabulary.js';

export interface AiSupportPriorityItem {
  /** Short, plain-language priority — never one of the six reserved result labels/terms. */
  priority: string;
  /** Why this priority, grounded in the evidence given to this call. */
  reason: string;
}

/**
 * Tiered support priorities (CLAUDE.md §13). Any tier may be an empty array — the model is
 * never forced to invent a priority it has no evidence for.
 */
export interface AiSupportPriorities {
  immediate: AiSupportPriorityItem[];
  short_term: AiSupportPriorityItem[];
  medium_term: AiSupportPriorityItem[];
  long_term: AiSupportPriorityItem[];
}

export interface AiResultsSummary {
  /** Assessment B's own likelihood — a SEPARATE scale from Assessment A's (rule 2, §2). */
  likelihood: AiLikelihoodLabel;
  /** Assessment B's own confidence — a SEPARATE value from Assessment A's (rule 3, §2). */
  confidence: Confidence;
  /** Why this likelihood — which areas of evidence contribute most (Guiding Principle, §13). */
  reasoning: string;
  /** Synthesized developmental pattern — never a restatement of one raw answer (rule 13). */
  developmentalProfile: string;
  /** Rendered before supportPriorities, both in this type's field order and in the UI (rule 15). */
  strengths: string[];
  supportPriorities: AiSupportPriorities;
  /** Narrative explanation of what's uncertain and why (CLAUDE.md §13: "explicitly named"). */
  uncertainty: string;
  /**
   * Structured companion to `uncertainty`, self-reported about Assessment B's OWN evidence
   * only — never references or implies anything about Assessment A (isolation, rule 7).
   * Consumed by the comparison engine to attribute a disagreement reason without needing to
   * parse free-form prose.
   */
  uncertaintyFactors: UncertaintyFactor[];
  /** Synthesized evidence summary — never a verbatim reflection of caregiver answers (rule 13). */
  evidenceSummary: string;
  homeRecommendations: string[];
  schoolRecommendations: string[];
  /**
   * The ONLY field permitted to name professional/specialist assessment (see the
   * professional-referral carve-out in
   * `docs/clinical-review/2026-07-11-dual-assessment-architecture.md`). Every other field
   * keeps the full ban on professional-referral language.
   */
  professionalAssessmentPriorities: string[];
  /** ISO 8601 timestamp of when this narrative was generated. */
  generatedAt: string;
}
