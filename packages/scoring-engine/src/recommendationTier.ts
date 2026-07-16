/**
 * Recommendation-tier derivation (product plan §4.4/§4.8, CLAUDE.md §2 rule 2).
 *
 * This is deterministic clinical logic — same category as scoring buckets and red-flag
 * rules — so it lives here, not in a consuming app, per CLAUDE.md §7 ("the scoring engine
 * is deterministic and rule-based... any LLM call may explain a score, never invent one").
 *
 * The product plan specifies red flags must trigger a recommendation and urgent red flags
 * must trigger the "strongly recommended soon" tier, but does not itself specify a
 * crosswalk from SupportLevelEstimate alone (no red flag present) to a recommendation
 * tier. The rule below — a "high" support estimate also recommends assessment even with
 * zero red flags — was reviewed and signed off by the clinical advisor 2026-07-16 (issue
 * #130), see docs/clinical-review/2026-07-16-issue130-recommendation-tier-signoff.md.
 *
 * Minimum-evidence gate (issue #22): with too little evidence overall, the answer is `null`
 * — no tier at all. Even "Support activities can begin now" reads as "we checked and this
 * is the next step", which one answer cannot support. Red flags are checked FIRST because
 * they are EXEMPT from the gate (CLAUDE.md §2 rule 8): one serious sign always yields a
 * recommendation, however sparse the rest of the intake.
 */
import {
  URGENT_RED_FLAG_TYPES,
  type Confidence,
  type RedFlag,
  type SupportLevelEstimate,
} from '@earlysteps/shared-types';
import type { RecommendationTier } from '@earlysteps/shared-types';

export function deriveRecommendationTier(
  redFlags: RedFlag[],
  supportEstimate: SupportLevelEstimate | null,
  sufficientOverallEvidence: boolean,
): RecommendationTier | null {
  // Red flags first — EXEMPT from the minimum-evidence gate below.
  const hasUrgentFlag = redFlags.some((f) =>
    (URGENT_RED_FLAG_TYPES as readonly string[]).includes(f.type),
  );
  if (hasUrgentFlag) return 'Formal assessment strongly recommended soon';

  if (redFlags.length > 0) return 'Formal assessment is recommended';

  // Not enough information yet — no recommendation of any kind (fail closed).
  if (!sufficientOverallEvidence) return null;

  if (supportEstimate?.level === 'high') return 'Formal assessment is recommended';

  return 'Support activities can begin now';
}

/**
 * The confidence a caregiver should read next to whatever `deriveRecommendationTier`
 * returned (issue #64: a recommendation with no confidence beside it can overstate
 * certainty). Deliberately mirrors that function's branching — pass the SAME
 * (already gate-checked) `supportEstimate` used there — so a null tier and a null
 * confidence always travel together and never contradict each other.
 *
 * Signed off by the clinical advisor 2026-07-09 (see
 * docs/clinical-review/2026-07-09-recommendation-confidence.md): a red flag is a hard
 * rule match on one explicit answer, not a weighted average, so the tier it forces is
 * reported at HIGH confidence regardless of how thin the rest of the intake is — the
 * alternative (borrowing the domain estimate's confidence) would let a sparse
 * questionnaire understate a serious sign the caregiver stated plainly.
 */
export function deriveRecommendationConfidence(
  redFlags: RedFlag[],
  supportEstimate: SupportLevelEstimate | null,
): Confidence | null {
  if (redFlags.length > 0) return 'high';
  return supportEstimate?.confidence ?? null;
}
