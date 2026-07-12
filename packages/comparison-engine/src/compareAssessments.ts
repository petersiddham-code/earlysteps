/**
 * The Comparison Section (CLAUDE.md §13/§14, rule 14 §2) — a THIRD, standalone computation
 * that runs AFTER Assessment A and Assessment B have each independently produced their own
 * output. It never feeds back into either engine (rule 7): it only reads a narrow `Pick<>`
 * of each side's already-computed fields, enforced at the type level below, and its output
 * is never written into Assessment A's or Assessment B's own records.
 *
 * The six disagreement reasons are attributed using ONLY: Assessment A's own already-
 * computed gate/confidence signals, and Assessment B's own self-reported
 * `uncertaintyFactors` (which describe uncertainty in Assessment B's OWN evidence only —
 * Assessment B never saw Assessment A's data, so this is not a leak across the boundary).
 *
 * The trigger conditions below are an original heuristic, not a clinically validated rule
 * set — flagged for advisor review in
 * docs/clinical-review/2026-07-11-dual-assessment-architecture.md, same placeholder status
 * as every other new-decision heuristic in this codebase (e.g.
 * packages/scoring-engine/src/recommendationTier.ts).
 */
import type {
  AiResultsSummary,
  ComparisonReason,
  ComparisonResult,
  ComparisonStatus,
  ResultsView,
} from '@earlysteps/shared-types';
import { COMPARISON_COPY } from '@earlysteps/content';
import { assessmentABand, assessmentBBand, bandDistance } from './bands.js';

/** The only Assessment A fields the comparator may read — enforced at the type level. */
export type AssessmentAComparisonInput = Pick<
  ResultsView,
  | 'domains'
  | 'supportLevel'
  | 'insufficientEvidenceOverall'
  | 'redFlagTypes'
  | 'recommendationTier'
  | 'recommendationConfidence'
>;

/** The only Assessment B fields the comparator may read — enforced at the type level. */
export type AssessmentBComparisonInput = Pick<
  AiResultsSummary,
  'likelihood' | 'confidence' | 'uncertaintyFactors'
>;

/** Fixed order so output is deterministic and snapshot-testable. */
const REASON_PRIORITY: ComparisonReason[] = [
  'contradictory_responses',
  'conflicting_developmental_history',
  'unsupported_text_evidence',
  'missing_observations',
  'low_confidence',
  'insufficient_evidence',
];

function order(reasons: Set<ComparisonReason>): ComparisonReason[] {
  return REASON_PRIORITY.filter((reason) => reasons.has(reason));
}

function narrative(
  status: ComparisonStatus,
  reasons: ComparisonReason[],
  hasRedFlag: boolean,
): string {
  const parts: string[] = [];
  // Rule 8 (§2): a red flag can never be softened or suppressed by this section, and a
  // red-flag-forced Assessment A tier can validly diverge from a free-text-derived
  // Assessment B likelihood — so this note is prepended unconditionally, before anything
  // the computed status/reasons say.
  if (hasRedFlag) parts.push(COMPARISON_COPY.red_flag_safety_note);
  parts.push(COMPARISON_COPY.statuses[status]);
  for (const reason of reasons) parts.push(COMPARISON_COPY.reasons[reason]);
  return parts.join(' ');
}

export function compareAssessments(
  a: AssessmentAComparisonInput,
  b: AssessmentBComparisonInput,
  computedAt: string = new Date().toISOString(),
): ComparisonResult {
  const hasRedFlag = a.redFlagTypes.length > 0;
  // ResultsView.recommendationTier is ALREADY null exactly in the true "nothing yet" state
  // (no red flag AND below the overall evidence floor) — a red flag forces a non-null tier
  // even while insufficientEvidenceOverall is true (rule 8, §2: red flags are exempt from
  // the evidence gate). Re-deriving from insufficientEvidenceOverall here would incorrectly
  // discard a valid red-flag-forced tier, so recommendationTier is used as-is.
  const aBand = assessmentABand(a.recommendationTier);
  const bBand = assessmentBBand(b.likelihood);

  // Assessment A is still evidence-gated: nothing to genuinely conflict with yet. Still
  // surface any self-reported evidence-quality concerns from B — informative regardless of
  // A's gate state, and dropping them would be a strictly worse read for no isolation gain.
  if (aBand === null) {
    const reasons = new Set<ComparisonReason>(['insufficient_evidence']);
    if (b.uncertaintyFactors.includes('contradictory_responses')) {
      reasons.add('contradictory_responses');
    }
    if (b.uncertaintyFactors.includes('conflicting_developmental_history')) {
      reasons.add('conflicting_developmental_history');
    }
    const orderedReasons = order(reasons);
    return {
      status: 'partial_agreement',
      reasons: orderedReasons,
      assessmentABand: null,
      assessmentBBand: bBand,
      bandDistance: null,
      narrative: narrative('partial_agreement', orderedReasons, hasRedFlag),
      computedAt,
    };
  }

  const distance = bandDistance(aBand, bBand);

  // Agreement-suppression rule: whenever the two sides actually line up, reasons are always
  // [] — attaching a "reason" to a case with no real disagreement would read as manufactured
  // doubt, even if B reported an uncertainty factor that would otherwise have triggered one.
  if (distance === 0) {
    return {
      status: 'agreement',
      reasons: [],
      assessmentABand: aBand,
      assessmentBBand: bBand,
      bandDistance: 0,
      narrative: narrative('agreement', [], hasRedFlag),
      computedAt,
    };
  }

  const reasons = new Set<ComparisonReason>();
  if (b.uncertaintyFactors.includes('contradictory_responses')) {
    reasons.add('contradictory_responses');
  }
  if (b.uncertaintyFactors.includes('conflicting_developmental_history')) {
    reasons.add('conflicting_developmental_history');
  }
  if (b.uncertaintyFactors.includes('limited_free_text_evidence')) {
    reasons.add('unsupported_text_evidence');
  }
  if (b.uncertaintyFactors.includes('sparse_structured_answers')) {
    reasons.add('insufficient_evidence');
  }
  if (a.domains.some((domain) => domain.status === 'insufficient_evidence')) {
    reasons.add('missing_observations');
  }
  if (
    a.recommendationConfidence === 'low' ||
    a.supportLevel?.confidence === 'low' ||
    b.confidence === 'low'
  ) {
    reasons.add('low_confidence');
  }

  let orderedReasons = order(reasons);
  // Placeholder catch-all (flagged for clinical-review sign-off, same as the trigger
  // conditions above): Assessment A never sees free text and Assessment B always does, so
  // an otherwise-unexplained band mismatch is presumptively attributable to evidence only
  // B had access to.
  if (orderedReasons.length === 0) orderedReasons = ['unsupported_text_evidence'];

  const status: ComparisonStatus = distance === 1 ? 'partial_agreement' : 'disagreement';
  return {
    status,
    reasons: orderedReasons,
    assessmentABand: aBand,
    assessmentBBand: bBand,
    bandDistance: distance,
    narrative: narrative(status, orderedReasons, hasRedFlag),
    computedAt,
  };
}
