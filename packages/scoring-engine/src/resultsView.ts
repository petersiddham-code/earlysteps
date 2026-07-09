/**
 * Maps the deterministic engine's internal output into the ONLY shape the API is allowed to
 * return (`ResultsView`, defined in @earlysteps/shared-types so both apps/backend and
 * apps/mobile can consume it without importing across apps). Lives here (rather than in
 * apps/backend) so guest/ephemeral sessions (issue #63) can shape a locally-recomputed
 * profile into the exact same wire shape as a persisted one, on-device, with zero duplicated
 * logic.
 *
 * Minimum-evidence gate (issue #22) is applied here as well as in the engine, so EVERY
 * consumer of the results endpoint inherits it (fail closed):
 *  - a finding is only rendered as a scored domain when it explicitly carries
 *    `sufficient_evidence: true` — snapshots computed before the gate existed lack the
 *    field and therefore map to the "not enough information yet" state until the next
 *    recompute heals them;
 *  - the stored support estimate is re-gated against the findings' answered counts, so a
 *    pre-gate estimate computed from one answer can never reach a caregiver;
 *  - red flags are EXEMPT (CLAUDE.md §2 rule 8): they always pass through, and
 *    deriveRecommendationTier checks them before the gate.
 *
 * Strengths-first ordering (CLAUDE.md §2 rule 6) and the actual "top 5 strengths / top 5
 * support needs" narrative (product plan §9.3) are LLM-summary concerns that don't exist yet
 * (LLM wiring is out of scope for this pipeline — see docs/clinical-review/content-gaps.md).
 * This view exposes the raw per-domain sign levels the summary step will eventually consume.
 */
import {
  INSUFFICIENT_EVIDENCE_LABEL,
  SCREENING_DISCLAIMER,
  SIGN_LEVEL_TO_LABEL,
  SUPPORT_LEVEL_TO_TERM,
  type DomainProfile,
  type RedFlag,
  type ResultsView,
  type ResultsViewDomain,
  type SupportLevelEstimate,
} from '@earlysteps/shared-types';
import {
  deriveRecommendationConfidence,
  deriveRecommendationTier,
} from './recommendationTier.js';
import { hasSufficientOverallEvidence } from './evidenceGate.js';

export type {
  ResultsView,
  ResultsViewDomain,
  ResultsViewSupportLevel,
} from '@earlysteps/shared-types';

export function toResultsView(
  profile: DomainProfile,
  supportEstimate: SupportLevelEstimate | null,
  redFlags: RedFlag[],
  /** Provenance: how many answers (latest per question) currently back this child's results. */
  basedOnAnswers: number,
): ResultsView {
  const domains: ResultsViewDomain[] = profile.findings.map((f) =>
    f.sufficient_evidence === true
      ? {
          domain: f.domain,
          status: 'scored',
          label: SIGN_LEVEL_TO_LABEL[f.level],
          confidence: f.confidence,
        }
      : {
          domain: f.domain,
          status: 'insufficient_evidence',
          label: INSUFFICIENT_EVIDENCE_LABEL,
        },
  );

  // Re-derive the overall gate from the stored findings rather than trusting the stored
  // estimate: `answered_count` missing (pre-gate snapshot) counts as 0 — fail closed.
  const scoredAnswerTotal = profile.findings.reduce(
    (sum, f) => sum + (f.answered_count ?? 0),
    0,
  );
  const sufficientOverall = hasSufficientOverallEvidence(scoredAnswerTotal);
  const gatedEstimate = sufficientOverall ? supportEstimate : null;

  return {
    disclaimer: SCREENING_DISCLAIMER,
    computedAt: profile.computed_at,
    basedOnAnswers,
    domains,
    supportLevel: gatedEstimate
      ? {
          term: SUPPORT_LEVEL_TO_TERM[gatedEstimate.level],
          confidence: gatedEstimate.confidence,
        }
      : null,
    insufficientEvidenceOverall: !sufficientOverall,
    redFlagTypes: redFlags.map((f) => f.type),
    recommendationTier: deriveRecommendationTier(
      redFlags,
      gatedEstimate,
      sufficientOverall,
    ),
    recommendationConfidence: deriveRecommendationConfidence(redFlags, gatedEstimate),
  };
}
