/**
 * Confirmation follow-ups for LLM-detected free-text signals (issue #26).
 *
 * The response-analysis stage may only ever SUGGEST one of these questions; the caregiver's
 * own structured answer is what the deterministic engine reads (a confirmed 'yes' on
 * `FU_<red_flag_type>` triggers the matching red-flag rule). Wordings are clinical content
 * (needs_clinical_signoff) — see docs/clinical-review/.
 */
import type { RedFlagType } from '@earlysteps/shared-types';
import followUps from '../follow-ups/follow-ups.json' with { type: 'json' };
import { followUpsFileSchema, type FollowUp, type FollowUpsFile } from './schema.js';

/** The validated follow-ups file. Parsed eagerly so a malformed file fails fast in CI. */
export const FOLLOW_UPS: FollowUpsFile = followUpsFileSchema.parse(followUps);

/** Follow-ups keyed by the red-flag type they confirm. */
export const FOLLOW_UPS_BY_RED_FLAG_TYPE: Partial<Record<RedFlagType, FollowUp>> =
  Object.fromEntries(FOLLOW_UPS.follow_ups.map((fu) => [fu.red_flag_type, fu]));

export function getFollowUp(followUpId: string): FollowUp | undefined {
  return FOLLOW_UPS.follow_ups.find((fu) => fu.id === followUpId);
}
