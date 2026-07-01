/**
 * Maps the deterministic engine's internal output into the ONLY shape the API is allowed to
 * return. This is where product plan §4.4 ("never a single autism-likelihood number... never
 * a raw numeric score") and CLAUDE.md §2 rule 5 (disclaimer on every result surface) are
 * enforced structurally: DomainFinding.score never appears on ResultsViewDomain, and
 * `disclaimer` is not optional.
 *
 * Strengths-first ordering (CLAUDE.md §2 rule 6) and the actual "top 5 strengths / top 5
 * support needs" narrative (product plan §9.3) are LLM-summary concerns that don't exist yet
 * (LLM wiring is out of scope for this pipeline — see docs/clinical-review/content-gaps.md).
 * This view exposes the raw per-domain sign levels the summary step will eventually consume.
 */
import {
  SCREENING_DISCLAIMER,
  SIGN_LEVEL_TO_LABEL,
  SUPPORT_LEVEL_TO_TERM,
  type Confidence,
  type Domain,
  type DomainProfile,
  type RecommendationTier,
  type RedFlag,
  type RedFlagType,
  type SignLevelLabel,
  type SupportLevelEstimate,
  type SupportLevelTerm,
} from '@earlysteps/shared-types';
import { deriveRecommendationTier } from '@earlysteps/scoring-engine';

export interface ResultsViewDomain {
  domain: Domain;
  label: SignLevelLabel;
  confidence: Confidence;
}

export interface ResultsViewSupportLevel {
  term: SupportLevelTerm;
  confidence: Confidence;
}

export interface ResultsView {
  disclaimer: string;
  computedAt: string;
  domains: ResultsViewDomain[];
  supportLevel: ResultsViewSupportLevel | null;
  redFlagTypes: RedFlagType[];
  recommendationTier: RecommendationTier;
}

export function toResultsView(
  profile: DomainProfile,
  supportEstimate: SupportLevelEstimate | null,
  redFlags: RedFlag[],
): ResultsView {
  return {
    disclaimer: SCREENING_DISCLAIMER,
    computedAt: profile.computed_at,
    domains: profile.findings.map((f) => ({
      domain: f.domain,
      label: SIGN_LEVEL_TO_LABEL[f.level],
      confidence: f.confidence,
    })),
    supportLevel: supportEstimate
      ? {
          term: SUPPORT_LEVEL_TO_TERM[supportEstimate.level],
          confidence: supportEstimate.confidence,
        }
      : null,
    redFlagTypes: redFlags.map((f) => f.type),
    recommendationTier: deriveRecommendationTier(redFlags, supportEstimate),
  };
}
