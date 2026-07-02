/**
 * Minimum-evidence gate (issue #22): below a floor of answered scored questions, the engine
 * emits a distinct "not enough information yet" state instead of a domain level, support
 * estimate, or recommendation tier. One answered question must never unlock
 * "moderate support needs" — caregivers read the label, not the confidence qualifier, and
 * established screeners (M-CHAT-R etc.) emit no score until the instrument is complete.
 *
 * The floors live in @earlysteps/content (thresholds/evidence-floors.json) because they are
 * CLINICAL CONTENT: placeholder values pending advisor sign-off, same precedent as the
 * placeholder scoring weights (docs/clinical-review/2026-07-02-minimum-evidence-gate.md).
 *
 * RED FLAGS ARE EXEMPT (CLAUDE.md §2 rule 8): red-flag rules run independently against raw
 * responses and this gate must never hide one — nothing in this module is consulted on the
 * red-flag path, and deriveRecommendationTier checks flags BEFORE the gate.
 */
import { EVIDENCE_FLOORS } from '@earlysteps/content';

/**
 * Per-domain floor: with fewer scored answers than this in a domain, no traffic light —
 * the finding is marked insufficient. When the total number of scored questions available
 * to this child in the domain is known and smaller than the floor, the floor drops to that
 * total, so a fully-answered sparse domain (e.g. a band with only two attention questions)
 * is not gated forever.
 */
export function hasSufficientDomainEvidence(
  answeredCount: number,
  totalAvailableInDomain?: number,
): boolean {
  const floor =
    totalAvailableInDomain !== undefined && totalAvailableInDomain > 0
      ? Math.min(EVIDENCE_FLOORS.min_scored_answers_per_domain, totalAvailableInDomain)
      : EVIDENCE_FLOORS.min_scored_answers_per_domain;
  return answeredCount >= floor;
}

/**
 * Overall floor: with fewer total scored answers than this, no support-level estimate and
 * no recommendation tier (unless a red flag forces one — flags are exempt).
 */
export function hasSufficientOverallEvidence(scoredAnswerCount: number): boolean {
  return scoredAnswerCount >= EVIDENCE_FLOORS.min_scored_answers_overall;
}
