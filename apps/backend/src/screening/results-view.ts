/**
 * Maps the deterministic engine's internal output into the ONLY shape the API is allowed to
 * return (`ResultsView`, defined in @earlysteps/shared-types so apps/mobile can consume it
 * without importing across apps).
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
  type DomainProfile,
  type RedFlag,
  type ResultsView,
  type SupportLevelEstimate,
} from '@earlysteps/shared-types';
import { deriveRecommendationTier } from '@earlysteps/scoring-engine';

export type {
  ResultsView,
  ResultsViewDomain,
  ResultsViewSupportLevel,
} from '@earlysteps/shared-types';

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
