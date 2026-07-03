/**
 * Question bank schema (CLAUDE.md §5, product plan §4.1b–4.1c).
 *
 * Questions live as versioned JSON in packages/content, NOT inline in components. Every
 * question follows the "no hard questions" rules: closed-choice by default, a concrete
 * example baked into the text, a reassuring `hint` under it, and an "I'm not sure" option.
 * `hint` is required — do not ship a question without one.
 */

import type { Domain, QuestionAgeBand } from './domains.js';

/** Input affordances from product plan §4.1b. */
export const QUESTION_TYPES = [
  'buttons', // big-tap single-select (◯ options)
  'dropdown', // natural range: age, frequency, word counts
  'chip_multi_select', // "which of these apply"
  'emoji_slider', // 😊 → 😐 → 😣, readable at low literacy
  'text', // always optional, never the primary input
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export interface QuestionOption {
  /** Stable id used by the scoring engine to map an answer to indicators. */
  id: string;
  /** Caregiver-facing label. */
  label: string;
}

/**
 * Bank-wide convention id for an "Other — type it" option (#28). Selecting it reveals an
 * inline text input; what the caregiver types travels as a `free_text:` entry alongside
 * this id, so the scoring engine and red-flag rules see only stable option ids.
 */
export const OTHER_OPTION_ID = 'other';

export interface Question {
  /** Stable id, e.g. "U1", "T4", "P12". */
  id: string;
  domain: Domain | 'profile' | 'strengths';
  age_band: QuestionAgeBand;
  /** Caregiver-facing text; `[child]` is replaced in-app with the child's name. */
  text: string;
  type: QuestionType;
  /** Closed-choice options. Empty only for free-text/age-picker inputs. */
  options: QuestionOption[];
  /** Required reassuring/explanatory support text shown under the question. */
  hint: string;
  /** Whether an optional "add anything else" free-text box is offered alongside. */
  allow_free_text?: boolean;
  /** Optional follow-up question id, surfaced conditionally. */
  follow_up?: string;
  /**
   * Where this answer is collected instead of the questionnaire flow. Questions carrying
   * this flag stay in the bank (single source of truth, versioned, reviewable) but are
   * deliberately not asked again in the wizard — e.g. U1 (age) and U2 (family languages)
   * are already answered during Child Profile Setup, and re-asking costs goodwill with
   * tired caregivers (#24).
   */
  collected_at?: 'profile_setup';
}

/** A versioned, localised question-bank file as stored in packages/content. */
export interface QuestionBank {
  version: string;
  locale: string;
  age_band: QuestionAgeBand;
  questions: Question[];
}

/**
 * Namespace prefix for caregiver free-text entries inside an `IntakeResponse.answer`
 * array (questions with `allow_free_text`). The prefix guarantees a typed answer can
 * never be mistaken for an option id downstream: the scoring engine weights unknown ids
 * as 0, and red-flag rules compare exact option ids — but a caregiver typing e.g. "yes"
 * must still never collide with an option literally named "yes".
 */
export const FREE_TEXT_ANSWER_PREFIX = 'free_text:';

/** Wraps caregiver-typed text for storage inside an answer array. */
export function makeFreeTextAnswer(text: string): string {
  return `${FREE_TEXT_ANSWER_PREFIX}${text}`;
}

/** True if this answer-array entry is caregiver-typed text, not an option id. */
export function isFreeTextAnswer(entry: string): boolean {
  return entry.startsWith(FREE_TEXT_ANSWER_PREFIX);
}

/** Returns the caregiver's own words from a free-text entry. */
export function stripFreeTextPrefix(entry: string): string {
  return isFreeTextAnswer(entry) ? entry.slice(FREE_TEXT_ANSWER_PREFIX.length) : entry;
}
