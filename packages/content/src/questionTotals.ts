import type { Domain, QuestionAgeBand } from '@earlysteps/shared-types';
import { getQuestionBank, QUESTION_BANKS } from './questions.js';
import { INDICATORS_BY_QUESTION } from './weights.js';

/**
 * How many scored (weight-bearing) questions a child in this age band can actually be
 * asked, per domain: the universal bank plus the band's own bank.
 *
 * This is the denominator the scoring engine's minimum-evidence gate and confidence
 * completeness need (issue #52). Without it the engine falls back to counting weighted
 * questions across ALL banks, which no single child can ever be asked — leaving sparse
 * band/domain pairs (e.g. toddler repetitive behaviours: 2 questions vs a floor of 3)
 * permanently "Not enough information yet" no matter how completely the caregiver answers,
 * and understating completeness unevenly across domains.
 */
export function domainQuestionTotalsForBand(
  ageBand: QuestionAgeBand,
): Partial<Record<Domain, number>> {
  const bandQuestions = getQuestionBank(ageBand)?.questions ?? [];
  const universalQuestions = QUESTION_BANKS.universal?.questions ?? [];
  const totals: Partial<Record<Domain, number>> = {};
  for (const question of [...universalQuestions, ...bandQuestions]) {
    const indicator = INDICATORS_BY_QUESTION[question.id];
    if (!indicator) continue;
    totals[indicator.domain] = (totals[indicator.domain] ?? 0) + 1;
  }
  return totals;
}
