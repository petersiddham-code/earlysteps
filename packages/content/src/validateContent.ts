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
  FOLLOW_UP_ANSWER_OPTIONS,
  INSUFFICIENT_EVIDENCE_LABEL,
  RED_FLAG_TYPES,
  SIGN_LEVEL_TO_LABEL,
  SUPPORT_LEVEL_TO_TERM,
  SCREENING_DISCLAIMER,
  SIGN_LEVELS,
  SUPPORT_LEVELS,
  UNCERTAINTY_OPTION_IDS,
  followUpQuestionId,
} from '@earlysteps/shared-types';
import { questionBankSchema } from './schema.js';
import { QUESTION_BANKS, allQuestions } from './questions.js';
import { WEIGHTS } from './weights.js';
import { EVIDENCE_FLOORS } from './evidenceFloors.js';
import { RESULT_COPY } from './resultCopy.js';
import { CONSENT_COPY } from './consentCopy.js';
import { FOLLOW_UPS } from './followUps.js';

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

  // 2b. A question the wizard would render but the caregiver could not answer (no options,
  // not free-text) must carry `collected_at` — its exclusion from the flow has to be a
  // deliberate, reviewable content decision, never an accident of an empty options array (#24).
  for (const q of questions) {
    const answerable = q.type === 'text' || q.options.length > 0;
    if (!answerable && q.collected_at === undefined) {
      errors.push(
        `questions: ${q.id} has no options and is not free-text — either give it options or mark where its answer is collected (collected_at)`,
      );
    }
  }

  // 3. Weights reference real questions, matching domains, and real option ids.
  for (const ind of WEIGHTS.indicators) {
    const q = byId.get(ind.question_id);
    if (!q) {
      errors.push(`weights: indicator references unknown question ${ind.question_id}`);
      continue;
    }
    // A collected_at question is never asked in the questionnaire, so a weight on it
    // would silently never fire — that's a content bug, not a tuning choice.
    if (q.collected_at !== undefined) {
      errors.push(
        `weights: ${ind.question_id} is collected at '${q.collected_at}', not asked in the questionnaire — its weight would never apply`,
      );
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

  if (RESULT_COPY.insufficient_evidence.label !== INSUFFICIENT_EVIDENCE_LABEL) {
    errors.push(
      'result-copy: insufficient_evidence.label does not match the approved "not enough information yet" state string',
    );
  }

  // 4b. Evidence floors must be internally coherent: an overall floor below the per-domain
  // floor would let a single almost-gated domain unlock the overall estimate.
  if (
    EVIDENCE_FLOORS.min_scored_answers_overall <
    EVIDENCE_FLOORS.min_scored_answers_per_domain
  ) {
    errors.push(
      'evidence-floors: min_scored_answers_overall is below min_scored_answers_per_domain',
    );
  }

  // 5. Every consent scope in the vocabulary has copy — no silent gaps in the consent screen.
  for (const scope of CONSENT_SCOPES) {
    if (!CONSENT_COPY.scopes[scope]) {
      errors.push(`consent-copy: missing copy for scope '${scope}'`);
    }
  }

  // 6. Follow-ups (issue #26): every red-flag type has exactly one confirmation follow-up
  //    whose id is FU_<type> (what the deterministic red-flag rules read), offering exactly
  //    the closed yes/no/not_sure choices, with no id collision against the question banks
  //    and no scoring weight (a confirmation must never also be averaged into a domain score).
  const followUpsByType = new Map(
    FOLLOW_UPS.follow_ups.map((fu) => [fu.red_flag_type, fu]),
  );
  for (const type of RED_FLAG_TYPES) {
    const fu = followUpsByType.get(type);
    if (!fu) {
      errors.push(
        `follow-ups: missing confirmation follow-up for red-flag type '${type}'`,
      );
      continue;
    }
    if (fu.id !== followUpQuestionId(type)) {
      errors.push(
        `follow-ups: '${type}' follow-up id '${fu.id}' != expected '${followUpQuestionId(type)}'`,
      );
    }
    const optionIds = fu.options.map((o) => o.id).sort();
    if (optionIds.join(',') !== [...FOLLOW_UP_ANSWER_OPTIONS].sort().join(',')) {
      errors.push(`follow-ups: '${fu.id}' must offer exactly yes/no/not_sure options`);
    }
  }
  if (FOLLOW_UPS.follow_ups.length !== followUpsByType.size) {
    errors.push('follow-ups: duplicate red_flag_type entries');
  }
  for (const fu of FOLLOW_UPS.follow_ups) {
    if (byId.has(fu.id)) {
      errors.push(`follow-ups: id '${fu.id}' collides with a question bank id`);
    }
    if (WEIGHTS.indicators.some((ind) => ind.question_id === fu.id)) {
      errors.push(`follow-ups: '${fu.id}' must not carry a scoring weight`);
    }
  }

  return { ok: errors.length === 0, errors };
}
