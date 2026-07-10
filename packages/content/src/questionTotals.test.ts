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

  it('pins issue #81: repetitive_behaviour reaches the 3-item evidence floor in toddler/young_adult', () => {
    // Before #81, toddler (T10, T11) and young_adult (YA5, YA6) sat at 2 items each — the
    // last remaining gap after TE13 (#54) closed teen. If any of these regress, that's a
    // clinical-content decision, so a conscious test update is the point.
    expect(
      domainQuestionTotalsForBand('toddler').repetitive_behaviour,
    ).toBeGreaterThanOrEqual(3);
    expect(
      domainQuestionTotalsForBand('young_adult').repetitive_behaviour,
    ).toBeGreaterThanOrEqual(3);
  });

  it('pins issue #78: sensory reaches the 3-item evidence floor in every band', () => {
    // Before #78, preschool/primary/teen/young_adult sensory sat at 1-2 items (below the
    // floor of 3), the sharpest drop-off in the coverage matrix. If any of these regress,
    // that's a clinical-content decision, so a conscious test update is the point.
    for (const band of AGE_BANDS) {
      expect(domainQuestionTotalsForBand(band).sensory).toBeGreaterThanOrEqual(3);
    }
  });

  it('pins issue #79: attention reaches the 3-item evidence floor in toddler/preschool/primary', () => {
    // Before #79, toddler/preschool/primary attention sat at 1 item each (below the floor
    // of 3) — thin on every band it was asked in at all. Teen/young_adult stay at 0 (`—`),
    // a separate scope question, not addressed here. If any of these regress, that's a
    // clinical-content decision, so a conscious test update is the point.
    expect(domainQuestionTotalsForBand('toddler').attention).toBeGreaterThanOrEqual(3);
    expect(domainQuestionTotalsForBand('preschool').attention).toBeGreaterThanOrEqual(3);
    expect(domainQuestionTotalsForBand('primary').attention).toBeGreaterThanOrEqual(3);
  });

  it('pins issue #80: communication reaches the 3-item evidence floor in teen/young_adult', () => {
    // Before #80, teen/young_adult communication sat at 2 items each — the smallest gap in
    // the coverage matrix. If any of these regress, that's a clinical-content decision, so
    // a conscious test update is the point.
    expect(domainQuestionTotalsForBand('teen').communication).toBeGreaterThanOrEqual(3);
    expect(
      domainQuestionTotalsForBand('young_adult').communication,
    ).toBeGreaterThanOrEqual(3);
  });

  it('pins issue #82: emotional_regulation reaches the 3-item evidence floor in toddler/preschool/primary', () => {
    // Before #82, toddler/preschool sat at 1 item (just the sleep question, T15/P21) and
    // primary sat at 2 (PR13 frustration-coping + PR17 sleep) — the last remaining gap
    // after #65's sleep-question work closed teen/young_adult as a side effect. If any of
    // these regress, that's a clinical-content decision, so a conscious test update is the
    // point.
    expect(
      domainQuestionTotalsForBand('toddler').emotional_regulation,
    ).toBeGreaterThanOrEqual(3);
    expect(
      domainQuestionTotalsForBand('preschool').emotional_regulation,
    ).toBeGreaterThanOrEqual(3);
    expect(
      domainQuestionTotalsForBand('primary').emotional_regulation,
    ).toBeGreaterThanOrEqual(3);
  });

  it('pins issue #91: attention reaches the 3-item evidence floor in teen/young_adult', () => {
    // Before #91, teen/young_adult had zero attention items — the domain wasn't asked at
    // all in either band (confirmed a real gap, not intentional, by issue #83). Three
    // newly authored items each (TE18-20, YA17-19) close it to the floor of 3. If any of
    // these regress, that's a clinical-content decision, so a conscious test update is the
    // point.
    expect(domainQuestionTotalsForBand('teen').attention).toBeGreaterThanOrEqual(3);
    expect(domainQuestionTotalsForBand('young_adult').attention).toBeGreaterThanOrEqual(
      3,
    );
  });

  it('pins issue #92: learning reaches the 3-item evidence floor in young_adult', () => {
    // Before #92, young_adult asked zero learning items — the domain wasn't asked at all
    // (confirmed a real gap, not intentional, by issue #83). Three newly authored items
    // (YA20-22) close it to the floor of 3. If this regresses, that's a clinical-content
    // decision, so a conscious test update is the point.
    expect(domainQuestionTotalsForBand('young_adult').learning).toBeGreaterThanOrEqual(3);
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
