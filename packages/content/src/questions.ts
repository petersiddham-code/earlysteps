import type { QuestionBank, QuestionAgeBand, Question } from '@earlysteps/shared-types';
import universal from '../questions/universal.json';
import toddler from '../questions/toddler.json';
import preschool from '../questions/preschool.json';

/** Raw banks keyed by age band. Validated by validateContent()/tests before trusted. */
export const QUESTION_BANKS: Record<string, QuestionBank> = {
  universal: universal as QuestionBank,
  toddler: toddler as QuestionBank,
  preschool: preschool as QuestionBank,
};

export function getQuestionBank(ageBand: QuestionAgeBand): QuestionBank | undefined {
  return QUESTION_BANKS[ageBand];
}

/** All questions across every shipped bank, flattened. */
export function allQuestions(): Question[] {
  return Object.values(QUESTION_BANKS).flatMap((bank) => bank.questions);
}
