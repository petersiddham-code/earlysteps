/**
 * Recommendation-tier derivation (product plan §4.4/§4.8, CLAUDE.md §2 rule 2).
 *
 * This is deterministic clinical logic — same category as scoring buckets and red-flag
 * rules — so it lives here, not in a consuming app, per CLAUDE.md §7 ("the scoring engine
 * is deterministic and rule-based... any LLM call may explain a score, never invent one").
 *
 * PLACEHOLDER HEURISTIC pending clinical review (see docs/clinical-review/content-gaps.md):
 * the product plan specifies red flags must trigger a recommendation and urgent red flags
 * must trigger the "strongly recommended soon" tier, but it does not specify a crosswalk
 * from SupportLevelEstimate alone (no red flag present) to a recommendation tier. The rule
 * below — a "high" support estimate also recommends assessment even with zero red flags —
 * is a reasonable interpretation, not a clinically validated threshold.
 *
 * Minimum-evidence gate (issue #22): with too little evidence overall, the answer is `null`
 * — no tier at all. Even "Support activities can begin now" reads as "we checked and this
 * is the next step", which one answer cannot support. Red flags are checked FIRST because
 * they are EXEMPT from the gate (CLAUDE.md §2 rule 8): one serious sign always yields a
 * recommendation, however sparse the rest of the intake.
 */
import {
  URGENT_RED_FLAG_TYPES,
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
