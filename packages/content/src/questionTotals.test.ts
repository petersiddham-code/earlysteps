import { describe, it, expect } from 'vitest';
import { AGE_BANDS } from '@earlysteps/shared-types';
import { domainQuestionTotalsForBand } from './questionTotals.js';
import { INDICATORS_BY_QUESTION } from './weights.js';
import { getQuestionBank, QUESTION_BANKS } from './questions.js';

describe('domainQuestionTotalsForBand (issue #52)', () => {
  it('counts only universal + own-band weighted questions, never other bands', () => {
    for (const band of AGE_BANDS) {
      const totals = domainQuestionTotalsForBand(band);
      const askableIds = new Set(
        [
          ...(QUESTION_BANKS.universal?.questions ?? []),
          ...(getQuestionBank(band)?.questions ?? []),
        ].map((q) => q.id),
      );
      const expected: Record<string, number> = {};
      for (const [qid, ind] of Object.entries(INDICATORS_BY_QUESTION)) {
        if (askableIds.has(qid)) expected[ind.domain] = (expected[ind.domain] ?? 0) + 1;
      }
      expect(totals).toEqual(expected);
    }
  });

  it('pins the issue #52 repro: a toddler can only ever be asked 2 repetitive-behaviour questions (T10, T11)', () => {
    // If this changes, the evidence-gate behaviour for toddlers changes with it — that's
    // a clinical-content decision, so a conscious test update is the point.
    expect(domainQuestionTotalsForBand('toddler').repetitive_behaviour).toBe(2);
  });

  it('pins issue #78: sensory reaches the 3-item evidence floor in every band', () => {
    // Before #78, preschool/primary/teen/young_adult sensory sat at 1-2 items (below the
    // floor of 3), the sharpest drop-off in the coverage matrix. If any of these regress,
    // that's a clinical-content decision, so a conscious test update is the point.
    for (const band of AGE_BANDS) {
      expect(domainQuestionTotalsForBand(band).sensory).toBeGreaterThanOrEqual(3);
    }
  });

  it('every band total is at most the all-bank total for that domain', () => {
    const allBank: Record<string, number> = {};
    for (const ind of Object.values(INDICATORS_BY_QUESTION)) {
      allBank[ind.domain] = (allBank[ind.domain] ?? 0) + 1;
    }
    for (const band of AGE_BANDS) {
      for (const [domain, count] of Object.entries(domainQuestionTotalsForBand(band))) {
        expect(count).toBeLessThanOrEqual(allBank[domain] ?? 0);
      }
    }
  });
});
