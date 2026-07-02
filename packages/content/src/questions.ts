import type { QuestionBank, QuestionAgeBand, Question } from '@earlysteps/shared-types';
// Node's ESM loader requires the `type: "json"` import attribute at runtime — Vite/Vitest's
// bundler-style resolution tolerates a bare import, but real `node --loader ...` execution
// (e.g. ts-node running the backend) does not. Keep this even though tsc's "Bundler"
// moduleResolution doesn't require it for type-checking.
import universal from '../questions/universal.json' with { type: 'json' };
import toddler from '../questions/toddler.json' with { type: 'json' };
import preschool from '../questions/preschool.json' with { type: 'json' };
import primary from '../questions/primary.json' with { type: 'json' };
import teen from '../questions/teen.json' with { type: 'json' };
import youngAdult from '../questions/young-adult.json' with { type: 'json' };

/** Raw banks keyed by age band. Validated by validateContent()/tests before trusted. */
export const QUESTION_BANKS: Record<string, QuestionBank> = {
  universal: universal as QuestionBank,
  toddler: toddler as QuestionBank,
  preschool: preschool as QuestionBank,
  primary: primary as QuestionBank,
  teen: teen as QuestionBank,
  young_adult: youngAdult as QuestionBank,
};

export function getQuestionBank(ageBand: QuestionAgeBand): QuestionBank | undefined {
  return QUESTION_BANKS[ageBand];
}

/** All questions across every shipped bank, flattened. */
export function allQuestions(): Question[] {
  return Object.values(QUESTION_BANKS).flatMap((bank) => bank.questions);
}

/**
 * True if the questionnaire wizard should ask this question. Questions whose answer is
 * already collected elsewhere (`collected_at`, e.g. age and family languages during Child
 * Profile Setup) are deliberately excluded so a tired caregiver is never asked twice (#24).
 * The flag lives in the bank JSON — content stays the single source of truth for why a
 * question exists but isn't asked, rather than ids hardcoded in a screen.
 */
export function isAskedInQuestionnaire(question: Question): boolean {
  return question.collected_at === undefined;
}
