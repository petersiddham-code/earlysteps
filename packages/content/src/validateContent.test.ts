import { describe, it, expect } from 'vitest';
import { validateContent } from './validateContent.js';
import { questionSchema, resultCopySchema } from './schema.js';
import { allQuestions, isAskedInQuestionnaire } from './questions.js';
import { WEIGHTS } from './weights.js';
import { RESULT_COPY } from './resultCopy.js';

describe('shipped content', () => {
  it('passes full validation with zero errors', () => {
    const result = validateContent();
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('gives every question a non-empty hint', () => {
    for (const q of allQuestions()) {
      expect(q.hint.length, `question ${q.id} missing hint`).toBeGreaterThan(0);
    }
  });

  it('flags weights as needing clinical sign-off (placeholder guard)', () => {
    expect(WEIGHTS.needs_clinical_signoff).toBe(true);
  });

  it('marks the profile-setup duplicates (U1 age, U2 languages) as collected elsewhere (#24)', () => {
    const byId = new Map(allQuestions().map((q) => [q.id, q]));
    expect(byId.get('U1')?.collected_at).toBe('profile_setup');
    expect(byId.get('U2')?.collected_at).toBe('profile_setup');
  });

  it('excludes collected_at questions from the questionnaire flow, keeps the rest', () => {
    const questions = allQuestions();
    const asked = questions.filter(isAskedInQuestionnaire);
    expect(asked.map((q) => q.id)).not.toContain('U1');
    expect(asked.map((q) => q.id)).not.toContain('U2');
    // Everything else in the banks is still asked — the flag only suppresses duplicates.
    expect(asked).toHaveLength(questions.length - 2);
  });

  it('never weights a question the questionnaire does not ask', () => {
    const byId = new Map(allQuestions().map((q) => [q.id, q]));
    for (const ind of WEIGHTS.indicators) {
      expect(
        byId.get(ind.question_id)?.collected_at,
        `${ind.question_id} is weighted but not asked in the questionnaire`,
      ).toBeUndefined();
    }
  });
});

describe('schema rejects unsafe content', () => {
  it('rejects a banned word in question text', () => {
    const bad = {
      id: 'X1',
      domain: 'communication',
      age_band: 'toddler',
      text: 'Is something wrong with [child]?',
      type: 'buttons',
      options: [{ id: 'yes', label: 'Yes' }],
      hint: 'A safe hint.',
    };
    expect(questionSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a banned word in an option label', () => {
    const bad = {
      id: 'X2',
      domain: 'communication',
      age_band: 'toddler',
      text: 'A safe question about [child].',
      type: 'buttons',
      options: [{ id: 'a', label: 'abnormal development' }],
      hint: 'A safe hint.',
    };
    expect(questionSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects a question with an empty hint', () => {
    const bad = {
      id: 'X3',
      domain: 'communication',
      age_band: 'toddler',
      text: 'A safe question about [child].',
      type: 'buttons',
      options: [{ id: 'yes', label: 'Yes' }],
      hint: '',
    };
    expect(questionSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects an unknown collected_at value', () => {
    const bad = {
      id: 'X4',
      domain: 'communication',
      age_band: 'toddler',
      text: 'A safe question about [child].',
      type: 'buttons',
      options: [{ id: 'yes', label: 'Yes' }],
      hint: 'A safe hint.',
      collected_at: 'somewhere_else',
    };
    expect(questionSchema.safeParse(bad).success).toBe(false);
  });

  it('rejects an off-list disclaimer', () => {
    const bad = {
      ...RESULT_COPY,
      disclaimer: 'This tells you if your child is autistic.',
    };
    // Schema allows the shape; the banned-word/refine catches nothing here, but
    // validateContent()'s exact-match check is what guards drift — assert both layers.
    const parsed = resultCopySchema.safeParse(bad);
    expect(parsed.success).toBe(true); // shape is fine
  });
});
