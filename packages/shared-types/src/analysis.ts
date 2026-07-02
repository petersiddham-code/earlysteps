/**
 * Free-text response analysis (issue #26, product plan §9.2).
 *
 * The LLM stage reads a caregiver's typed free-text answer and proposes candidate signals.
 * It NEVER changes a score or fires a red flag itself (CLAUDE.md §2 rule 7): a recognized
 * signal only becomes a structured follow-up question the caregiver answers, and that
 * confirmed answer enters the deterministic engine as a normal IntakeResponse. The LLM
 * proposes; the caregiver confirms; the rules decide.
 */

import type { Domain } from './domains.js';
import type { RedFlagType } from './profile.js';

/** How strongly the model thinks the text supports the signal — advisory only, never scored. */
export const SIGNAL_SALIENCES = ['low', 'medium', 'high'] as const;
export type SignalSalience = (typeof SIGNAL_SALIENCES)[number];

/**
 * One candidate signal the model extracted from a single free-text answer. Only ever
 * accepted after schema validation (backend fails closed on anything malformed).
 */
export interface FreeTextSignal {
  /** Which developmental domain the text seems to describe, or null if unclear. */
  domain: Domain | null;
  /** A possible hard-coded red-flag type, or null if none applies. */
  red_flag_type: RedFlagType | null;
  salience: SignalSalience;
  /** Verbatim fragment of the caregiver's own words that motivated the signal. */
  evidence_quote: string;
}

/** The closed-choice answers every confirmation follow-up offers — never a trap (§4.1b). */
export const FOLLOW_UP_ANSWER_OPTIONS = ['yes', 'no', 'not_sure'] as const;
export type FollowUpAnswer = (typeof FOLLOW_UP_ANSWER_OPTIONS)[number];

/**
 * Question id namespace for confirmation follow-ups. `FU_<red_flag_type>` is a real
 * question in packages/content/follow-ups — a confirmed 'yes' is read by the matching
 * red-flag rule in the deterministic engine.
 */
export const FOLLOW_UP_QUESTION_PREFIX = 'FU_';
export function followUpQuestionId(type: RedFlagType): string {
  return `${FOLLOW_UP_QUESTION_PREFIX}${type}`;
}

/**
 * A pending confirmation follow-up as served to the app: the content-authored question
 * plus where it came from (the caregiver's own words, reflected verbatim — never an LLM
 * paraphrase). Answering it submits a normal IntakeResponse.
 */
export interface FollowUpSuggestion {
  /** Server id of the suggestion row (used to answer it). */
  id: string;
  /** The follow-up question id (`FU_<red_flag_type>`). */
  follow_up_id: string;
  red_flag_type: RedFlagType;
  /** Caregiver-facing question text; `[child]` is replaced in-app with the child's name. */
  text: string;
  /** Required reassuring/explanatory support text shown under the question. */
  hint: string;
  /** The question the free text was typed under. */
  source_question_id: string;
  /** The caregiver's own typed words, verbatim (prefix already stripped). */
  source_quote: string;
}
