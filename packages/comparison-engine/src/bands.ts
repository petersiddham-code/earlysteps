/**
 * A coarse 3-band risk position (`RiskBand`, @earlysteps/shared-types) that both
 * assessments' own vocabularies collapse onto SOLELY so the Comparison Section (CLAUDE.md
 * §13/§14) can measure how far apart they are. Neither collapsing function is ever used to
 * render a label on screen — each engine keeps rendering only its own vocabulary (rule 2).
 */
import type {
  AiLikelihoodLabel,
  RecommendationTier,
  RiskBand,
} from '@earlysteps/shared-types';

const TIER_TO_BAND: Record<RecommendationTier, RiskBand> = {
  'Support activities can begin now': 'low',
  'Formal assessment is recommended': 'medium',
  'Formal assessment strongly recommended soon': 'high',
};

/** Null in, null out — Assessment A reports no tier at all while it's evidence-gated. */
export function assessmentABand(tier: RecommendationTier | null): RiskBand | null {
  return tier === null ? null : TIER_TO_BAND[tier];
}

const LIKELIHOOD_TO_BAND: Record<AiLikelihoodLabel, RiskBand> = {
  'Very Low': 'low',
  Low: 'low',
  Moderate: 'medium',
  High: 'high',
  'Very High': 'high',
};

/** Assessment B always reports a likelihood, so this always returns a band. */
export function assessmentBBand(likelihood: AiLikelihoodLabel): RiskBand {
  return LIKELIHOOD_TO_BAND[likelihood];
}

const RISK_BAND_RANK: Record<RiskBand, number> = { low: 0, medium: 1, high: 2 };

export function bandDistance(a: RiskBand, b: RiskBand): 0 | 1 | 2 {
  return Math.abs(RISK_BAND_RANK[a] - RISK_BAND_RANK[b]) as 0 | 1 | 2;
}
