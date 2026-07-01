import type { Confidence, Domain, SupportLevel } from '@earlysteps/shared-types';
import { SOME_SIGNS_MIN, MANY_SIGNS_MIN } from './buckets.js';
import type { DomainScore } from './scoreDomain.js';

/**
 * Support-level estimate (product plan §8.4): a weighted combination of domain scores,
 * biased toward the two heaviest-evidence NICE/DSM-5 domains (social communication and
 * repetitive/restricted behaviours), cross-checked against daily-living/independence.
 *
 * Confidence flows from the weakest contributing domain — an estimate is only as trustworthy
 * as its thinnest evidence.
 */
export const DOMAIN_SUPPORT_WEIGHTS: Partial<Record<Domain, number>> = {
  social: 2,
  repetitive_behaviour: 2,
  communication: 1.5,
};
const DEFAULT_DOMAIN_WEIGHT = 1;

export interface SupportEstimate {
  level: SupportLevel;
  weightedScore: number;
}

export function estimateSupportLevel(
  domainScores: DomainScore[],
): SupportEstimate | null {
  if (domainScores.length === 0) return null;

  let weightedSum = 0;
  let weightTotal = 0;
  for (const ds of domainScores) {
    const w = DOMAIN_SUPPORT_WEIGHTS[ds.domain] ?? DEFAULT_DOMAIN_WEIGHT;
    weightedSum += ds.score * w;
    weightTotal += w;
  }
  let weightedScore = weightTotal > 0 ? weightedSum / weightTotal : 0;

  // Cross-check: strong daily-living/independence concerns nudge the estimate up, since
  // functional impact matters more than domain averages alone (product plan §8.4).
  const dailyLiving = domainScores.find((d) => d.domain === 'daily_living');
  if (dailyLiving && dailyLiving.score >= MANY_SIGNS_MIN) {
    weightedScore = Math.min(100, weightedScore + 10);
  }

  const level: SupportLevel =
    weightedScore >= MANY_SIGNS_MIN
      ? 'high'
      : weightedScore >= SOME_SIGNS_MIN
        ? 'moderate'
        : 'mild';

  return { level, weightedScore };
}

/** The estimate is only as confident as its weakest contributing domain. */
export function combineConfidence(confidences: Confidence[]): Confidence {
  if (confidences.includes('low') || confidences.length === 0) return 'low';
  if (confidences.includes('medium')) return 'medium';
  return 'high';
}
