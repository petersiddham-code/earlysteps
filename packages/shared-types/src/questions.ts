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
}

/** A versioned, localised question-bank file as stored in packages/content. */
export interface QuestionBank {
  version: string;
  locale: string;
  age_band: QuestionAgeBand;
  questions: Question[];
}
