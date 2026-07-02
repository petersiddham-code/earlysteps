import {
  UNCERTAINTY_OPTION_IDS,
  type Domain,
  type EvidenceRef,
  type IntakeResponse,
} from '@earlysteps/shared-types';
import type { Indicator } from '@earlysteps/content';
import { bucketScore } from './buckets.js';

const UNCERTAIN = new Set<string>(UNCERTAINTY_OPTION_IDS);

/**
 * Strips uncertainty selections ("not sure" / "prefer not to say") from an answer, returning
 * null when nothing evidentiary remains. An uncertain answer is a GAP, not evidence: it must
 * not pull the domain score down the way a reassuring answer does, and it must not count
 * toward answeredCount (which feeds confidence/completeness). Without this, a caregiver
 * answering "not sure" everywhere would get "Low signs observed" at inflated confidence.
 */
function withoutUncertainty(
  answer: IntakeResponse['answer'],
): IntakeResponse['answer'] | null {
  if (Array.isArray(answer)) {
    const kept = answer.filter((id) => !UNCERTAIN.has(id));
    return kept.length > 0 ? kept : null;
  }
  return UNCERTAIN.has(String(answer)) ? null : answer;
}

export interface DomainScore {
  domain: Domain;
  /** Normalized 0–100. NOT shown to caregivers — feeds the traffic-light level. */
  score: number;
  level: ReturnType<typeof bucketScore>;
  /** Number of scored (indicator-bearing, answered) questions behind this score. */
  answeredCount: number;
  evidence_refs: EvidenceRef[];
}

/** Contribution + max-possible for a single answered indicator question. */
function scoreOne(
  indicator: Indicator,
  answer: IntakeResponse['answer'],
): {
  contribution: number;
  max: number;
} {
  const weights = indicator.option_weights;
  const values = Object.values(weights);
  if (indicator.combine === 'sum') {
    const selected = Array.isArray(answer) ? answer : [String(answer)];
    const contribution = selected.reduce((sum, id) => sum + (weights[id] ?? 0), 0);
    const max = values.reduce((a, b) => a + b, 0);
    return { contribution, max };
  }
  // 'max' — single-select: the chosen option's weight (0 if reassuring / unweighted).
  const key = Array.isArray(answer) ? String(answer[0]) : String(answer);
  const contribution = weights[key] ?? 0;
  const max = values.length ? Math.max(...values) : 0;
  return { contribution, max };
}

/**
 * Deterministic per-domain scoring (product plan §8, CLAUDE.md §7). No LLM, no network.
 *
 * For each answered question that has a weight indicator, we add its contribution to the
 * numerator and its max-possible to the denominator, so a reassuring answer pulls the
 * domain score DOWN (it adds to the denominator, not the numerator). Only questions the
 * parent actually answered count, so the score reflects real evidence, not gaps.
 */
export function scoreDomains(
  responses: IntakeResponse[],
  indicatorsByQuestion: Record<string, Indicator>,
): DomainScore[] {
  const acc = new Map<
    Domain,
    { raw: number; max: number; count: number; evidence: EvidenceRef[] }
  >();

  for (const response of responses) {
    const indicator = indicatorsByQuestion[response.question_id];
    if (!indicator) continue;
    const answer = withoutUncertainty(response.answer);
    if (answer === null) continue; // "not sure" is a gap, not evidence — treat as unanswered
    const { contribution, max } = scoreOne(indicator, answer);
    if (max === 0) continue; // nothing weighted on this question — ignore

    const bucket = acc.get(indicator.domain) ?? {
      raw: 0,
      max: 0,
      count: 0,
      evidence: [],
    };
    bucket.raw += contribution;
    bucket.max += max;
    bucket.count += 1;
    if (contribution > 0) {
      bucket.evidence.push({ source: 'intake', ref_id: response.question_id });
    }
    acc.set(indicator.domain, bucket);
  }

  const out: DomainScore[] = [];
  for (const [domain, b] of acc) {
    const score = b.max > 0 ? (b.raw / b.max) * 100 : 0;
    out.push({
      domain,
      score,
      level: bucketScore(score),
      answeredCount: b.count,
      evidence_refs: b.evidence,
    });
  }
  return out;
}
