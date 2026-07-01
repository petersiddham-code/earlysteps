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
import { scoreDomains } from './scoreDomain.js';
import { computeConfidence } from './confidence.js';
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
  supportEstimate: SupportLevelEstimate | null;
  redFlags: RedFlag[];
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
  responses: IntakeResponse[],
  options: RecomputeOptions,
): RecomputeResult {
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
      };
    }),
  };

  const estimate = estimateSupportLevel(domainScores);
  const supportEstimate: SupportLevelEstimate | null = estimate
    ? {
        child_id: childId,
        level: estimate.level,
        confidence: combineConfidence(findingConfidences),
        computed_at: options.computedAt,
      }
    : null;

  // Red flags evaluated independently of the domain aggregation above.
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

  return { profile, supportEstimate, redFlags };
}
