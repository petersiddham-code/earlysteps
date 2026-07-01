import type { Confidence } from '@earlysteps/shared-types';

/**
 * Confidence is computed SEPARATELY from score (product plan §8.3, CLAUDE.md §7): a high
 * score must never imply high confidence by default. Inputs:
 *  - completeness: how much of the available intake was answered
 *  - corroboration: independent sources agreeing (parent report + activity + teacher)
 *  - consistency: whether those sources point the same way
 * Sparse data caps confidence at "low" no matter how alarming or reassuring the score.
 */
export interface ConfidenceInputs {
  answeredCount: number;
  totalPossible: number;
  /** Count of corroborating sources beyond the base parent intake (activities, teacher). */
  corroboratingSources: number;
  /** Whether the available sources are mutually consistent. */
  consistent: boolean;
}

/** Below this many answered items, confidence is capped at "low" regardless of ratio. */
export const MIN_ANSWERS_FOR_MEDIUM = 3;
export const HIGH_COMPLETENESS = 0.67;
export const LOW_COMPLETENESS = 0.34;

export function computeConfidence(inputs: ConfidenceInputs): Confidence {
  const { answeredCount, totalPossible, corroboratingSources, consistent } = inputs;
  const completeness = totalPossible > 0 ? answeredCount / totalPossible : 0;

  // Sparse data → always low (fail safe toward humility).
  if (answeredCount < MIN_ANSWERS_FOR_MEDIUM || completeness < LOW_COMPLETENESS) {
    return 'low';
  }

  if (completeness >= HIGH_COMPLETENESS && corroboratingSources >= 1 && consistent) {
    return 'high';
  }

  return 'medium';
}
