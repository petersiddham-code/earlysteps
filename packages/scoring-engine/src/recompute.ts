/**
 * Orchestrates the deterministic engine into the outputs the app consumes: a DomainProfile,
 * a SupportLevelEstimate, and any RedFlags. Recompute is PURE — it returns fresh objects and
 * never mutates prior profiles, so history is retained for trend graphs and clinician
 * reports (CLAUDE.md §7, product plan §8.6).
 */
import type {
  Confidence,
  Domain,
  DomainProfile,
  IntakeResponse,
  RedFlag,
  SupportLevelEstimate,
} from '@earlysteps/shared-types';
import { INDICATORS_BY_QUESTION, type Indicator } from '@earlysteps/content';
import { dedupeLatestByQuestion } from './dedupe.js';
import { scoreDomains } from './scoreDomain.js';
import { computeConfidence } from './confidence.js';
import {
  hasSufficientDomainEvidence,
  hasSufficientOverallEvidence,
} from './evidenceGate.js';
import { combineConfidence, estimateSupportLevel } from './supportLevel.js';
import { RED_FLAG_RULES } from './redFlags.js';

export interface RecomputeOptions {
  /** Weight indicators to score against. Defaults to the shipped content weights. */
  indicatorsByQuestion?: Record<string, Indicator>;
  /** How many scored questions were available to this child, per domain (for completeness). */
  domainQuestionTotals?: Partial<Record<Domain, number>>;
  /** Corroborating sources beyond parent intake (activities, teacher input). */
  corroboratingSources?: number;
  /** Whether available sources are mutually consistent. */
  consistent?: boolean;
  /** ISO timestamp for the computation (injected — the engine has no clock). */
  computedAt: string;
}

export interface RecomputeResult {
  profile: DomainProfile;
  /** Null when no domain evidence exists OR the overall evidence floor is unmet (issue #22). */
  supportEstimate: SupportLevelEstimate | null;
  redFlags: RedFlag[];
  /** Provenance: how many answers (latest per question) this recompute rested on. */
  answeredTotal: number;
  /** Overall minimum-evidence gate outcome. Red flags are exempt and reported regardless. */
  sufficientEvidenceOverall: boolean;
}

function defaultTotalsByDomain(
  indicators: Record<string, Indicator>,
): Partial<Record<Domain, number>> {
  const totals: Partial<Record<Domain, number>> = {};
  for (const ind of Object.values(indicators)) {
    totals[ind.domain] = (totals[ind.domain] ?? 0) + 1;
  }
  return totals;
}

export function recompute(
  allResponses: IntakeResponse[],
  options: RecomputeOptions,
): RecomputeResult {
  // Only the caregiver's CURRENT answer per question is evidence — a re-answered question
  // must not double-count in domain scores or feed a stale value to a red-flag rule.
  const responses = dedupeLatestByQuestion(allResponses);
  const childId = responses[0]?.child_id ?? 'unknown';
  const indicators = options.indicatorsByQuestion ?? INDICATORS_BY_QUESTION;
  const totals = options.domainQuestionTotals ?? defaultTotalsByDomain(indicators);
  const corroboratingSources = options.corroboratingSources ?? 0;
  const consistent = options.consistent ?? true;

  const domainScores = scoreDomains(responses, indicators);

  const findingConfidences: Confidence[] = [];
  const profile: DomainProfile = {
    child_id: childId,
    computed_at: options.computedAt,
    findings: domainScores.map((ds) => {
      const confidence = computeConfidence({
        answeredCount: ds.answeredCount,
        totalPossible: totals[ds.domain] ?? ds.answeredCount,
        corroboratingSources,
        consistent,
      });
      findingConfidences.push(confidence);
      return {
        domain: ds.domain,
        level: ds.level,
        score: Math.round(ds.score),
        confidence,
        evidence_refs: ds.evidence_refs,
        answered_count: ds.answeredCount,
        // Minimum-evidence gate (issue #22): level/score stay on the finding for audit and
        // trend history, but consumers must show "not enough information yet" instead of
        // them while this is false. Red flags below are exempt.
        sufficient_evidence: hasSufficientDomainEvidence(
          ds.answeredCount,
          totals[ds.domain],
        ),
      };
    }),
  };

  // Overall minimum-evidence gate (issue #22): below the floor of total scored answers, no
  // support-level estimate at all — "moderate support needs (low confidence)" off one
  // answer is still far too strong a statement.
  const scoredAnswerTotal = domainScores.reduce((sum, ds) => sum + ds.answeredCount, 0);
  const sufficientEvidenceOverall = hasSufficientOverallEvidence(scoredAnswerTotal);

  const estimate = sufficientEvidenceOverall ? estimateSupportLevel(domainScores) : null;
  const supportEstimate: SupportLevelEstimate | null = estimate
    ? {
        child_id: childId,
        level: estimate.level,
        confidence: combineConfidence(findingConfidences),
        computed_at: options.computedAt,
      }
    : null;

  // Red flags evaluated independently of the domain aggregation above — and EXEMPT from
  // the minimum-evidence gate: one serious sign surfaces even as the only answer given
  // (CLAUDE.md §2 rule 8).
  const redFlags: RedFlag[] = [];
  for (const rule of RED_FLAG_RULES) {
    const refs = rule.check(responses);
    if (refs.length > 0) {
      redFlags.push({
        child_id: childId,
        type: rule.type,
        triggered_at: options.computedAt,
        evidence_refs: refs,
        resolved: false,
      });
    }
  }

  return {
    profile,
    supportEstimate,
    redFlags,
    answeredTotal: responses.length,
    sufficientEvidenceOverall,
  };
}
