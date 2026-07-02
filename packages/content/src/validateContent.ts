/**
 * Whole-content validation used by tests and the lint:content safety gate.
 *
 * Beyond schema-shape checks it enforces cross-file integrity that the safety rules depend
 * on: weights must reference real questions/options, and the shipped result labels must be
 * exactly the approved on-list strings (CLAUDE.md §2 rules 2–3, §5, §10). Fails closed —
 * any problem is an error, not a warning.
 */
import {
  CONSENT_SCOPES,
  SIGN_LEVEL_TO_LABEL,
  SUPPORT_LEVEL_TO_TERM,
  SCREENING_DISCLAIMER,
  SIGN_LEVELS,
  SUPPORT_LEVELS,
  UNCERTAINTY_OPTION_IDS,
} from '@earlysteps/shared-types';
import { questionBankSchema } from './schema.js';
import { QUESTION_BANKS, allQuestions } from './questions.js';
import { WEIGHTS } from './weights.js';
import { RESULT_COPY } from './resultCopy.js';
import { CONSENT_COPY } from './consentCopy.js';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateContent(): ValidationResult {
  const errors: string[] = [];

  // 1. Every question bank matches the schema (safe copy, required hints, valid enums).
  for (const [band, bank] of Object.entries(QUESTION_BANKS)) {
    const parsed = questionBankSchema.safeParse(bank);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(`questions/${band}: ${issue.path.join('.')} — ${issue.message}`);
      }
    }
  }

  // 2. No duplicate question ids across banks.
  const questions = allQuestions();
  const seen = new Set<string>();
  for (const q of questions) {
    if (seen.has(q.id)) errors.push(`duplicate question id: ${q.id}`);
    seen.add(q.id);
  }
  const byId = new Map(questions.map((q) => [q.id, q]));

  // 3. Weights reference real questions, matching domains, and real option ids.
  for (const ind of WEIGHTS.indicators) {
    const q = byId.get(ind.question_id);
    if (!q) {
      errors.push(`weights: indicator references unknown question ${ind.question_id}`);
      continue;
    }
    if (q.domain !== ind.domain) {
      errors.push(
        `weights: ${ind.question_id} domain '${ind.domain}' != question domain '${q.domain}'`,
      );
    }
    const optionIds = new Set(q.options.map((o) => o.id));
    for (const optId of Object.keys(ind.option_weights)) {
      if (!optionIds.has(optId)) {
        errors.push(`weights: ${ind.question_id} references unknown option '${optId}'`);
      }
      // "Not sure" is never a trap (product plan §4.1b): the scoring engine skips
      // uncertainty answers entirely, so a weight here would be silently ignored.
      if ((UNCERTAINTY_OPTION_IDS as readonly string[]).includes(optId)) {
        errors.push(
          `weights: ${ind.question_id} assigns a weight to uncertainty option '${optId}' — uncertainty answers are never scored`,
        );
      }
    }
  }

  // 4. Result copy is exactly the approved on-list vocabulary — no drift, no paraphrase.
  if (RESULT_COPY.disclaimer !== SCREENING_DISCLAIMER) {
    errors.push('result-copy: disclaimer does not match the verbatim approved text');
  }
  for (const level of SIGN_LEVELS) {
    if (RESULT_COPY.sign_level_labels[level] !== SIGN_LEVEL_TO_LABEL[level]) {
      errors.push(`result-copy: sign_level_labels.${level} is off-list`);
    }
  }
  for (const level of SUPPORT_LEVELS) {
    if (RESULT_COPY.support_level_terms[level] !== SUPPORT_LEVEL_TO_TERM[level]) {
      errors.push(`result-copy: support_level_terms.${level} is off-list`);
    }
  }

  // 5. Every consent scope in the vocabulary has copy — no silent gaps in the consent screen.
  for (const scope of CONSENT_SCOPES) {
    if (!CONSENT_COPY.scopes[scope]) {
      errors.push(`consent-copy: missing copy for scope '${scope}'`);
    }
  }

  return { ok: errors.length === 0, errors };
}
