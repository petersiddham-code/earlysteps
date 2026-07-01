import type { QuestionBank, QuestionAgeBand, Question } from '@earlysteps/shared-types';
// Node's ESM loader requires the `type: "json"` import attribute at runtime — Vite/Vitest's
// bundler-style resolution tolerates a bare import, but real `node --loader ...` execution
// (e.g. ts-node running the backend) does not. Keep this even though tsc's "Bundler"
// moduleResolution doesn't require it for type-checking.
import universal from '../questions/universal.json' with { type: 'json' };
import toddler from '../questions/toddler.json' with { type: 'json' };
import preschool from '../questions/preschool.json' with { type: 'json' };

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
