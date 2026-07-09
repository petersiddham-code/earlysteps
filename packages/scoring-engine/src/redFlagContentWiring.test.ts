/**
 * Red-flag ↔ content wiring (closes docs/clinical-review/content-gaps.md item 2).
 *
 * Every red-flag rule keys off specific question ids and option ids in the shipped content.
 * If content renames a question or option, the rule doesn't error — it silently never fires,
 * which is the worst possible failure for the most safety-critical code in the repo. This
 * suite pins every id a rule depends on to the real shipped banks so that failure mode is
 * impossible to reintroduce without a red build.
 */
import { describe, it, expect } from 'vitest';
import { FOLLOW_UPS, WEIGHTS, allQuestions, getQuestionBank } from '@earlysteps/content';
import { RED_FLAG_TYPES, followUpQuestionId } from '@earlysteps/shared-types';
import {
  RF_LOSS_OF_SKILLS_Q,
  RF_SELF_INJURY_Q,
  RF_SUDDEN_CHANGE_Q,
  RF_SAFETY_Q,
} from './redFlags.js';

const byId = new Map(allQuestions().map((q) => [q.id, q]));

function expectQuestionWithOptions(questionId: string, ...optionIds: string[]) {
  const q = byId.get(questionId);
  expect(q, `question ${questionId} must exist in a shipped bank`).toBeDefined();
  const opts = new Set(q!.options.map((o) => o.id));
  for (const optionId of optionIds) {
    expect(
      opts.has(optionId),
      `question ${questionId} must offer trigger option '${optionId}'`,
    ).toBe(true);
  }
}

describe('every red-flag rule references real shipped questions and options', () => {
  it('the four universal red-flag questions exist with a "yes" trigger option', () => {
    for (const id of [
      RF_LOSS_OF_SKILLS_Q,
      RF_SELF_INJURY_Q,
      RF_SUDDEN_CHANGE_Q,
      RF_SAFETY_Q,
    ]) {
      expectQuestionWithOptions(id, 'yes');
    }
  });

  it('the universal red-flag questions are in the universal bank, so every age band is asked', () => {
    const universalIds = new Set(
      (getQuestionBank('universal')?.questions ?? []).map((q) => q.id),
    );
    for (const id of [
      RF_LOSS_OF_SKILLS_Q,
      RF_SELF_INJURY_Q,
      RF_SUDDEN_CHANGE_Q,
      RF_SAFETY_Q,
    ]) {
      expect(universalIds.has(id), `${id} must be asked universally`).toBe(true);
    }
  });

  it('red-flag questions carry no scoring weight — a red flag can never be averaged into a domain score', () => {
    for (const id of [
      RF_LOSS_OF_SKILLS_Q,
      RF_SELF_INJURY_Q,
      RF_SUDDEN_CHANGE_Q,
      RF_SAFETY_Q,
    ]) {
      // domain 'profile' is structurally unweightable: the weights schema only accepts
      // real scoring domains, so these answers can only ever reach the red-flag rules.
      expect(byId.get(id)?.domain).toBe('profile');
    }
  });

  it('proxy-based rules reference real questions and trigger options', () => {
    expectQuestionWithOptions('T4', 'doesnt_notice'); // no name response (toddler)
    expectQuestionWithOptions('P5', 'rarely_responds'); // no name response (preschool)
    expectQuestionWithOptions('T2', 'none_yet'); // no functional communication (toddler)
    expectQuestionWithOptions('T3', 'rarely');
    expectQuestionWithOptions('P1', 'not_yet_talking'); // no functional communication (preschool)
    expectQuestionWithOptions('T14', 'so_few_worried_growth'); // severe feeding
    expectQuestionWithOptions('P16', 'so_few_worried_growth');
    // severe sleep — one question per age band (issue #65)
    expectQuestionWithOptions('T15', 'significant_struggles');
    expectQuestionWithOptions('P21', 'significant_struggles');
    expectQuestionWithOptions('PR17', 'significant_struggles');
    expectQuestionWithOptions('TE14', 'significant_struggles');
    expectQuestionWithOptions('YA12', 'significant_struggles');
  });

  it('every follow-up-confirmation id the rules read exists in shipped content with a "yes" option (issue #26)', () => {
    const followUpsById = new Map(FOLLOW_UPS.follow_ups.map((fu) => [fu.id, fu]));
    for (const type of RED_FLAG_TYPES) {
      const id = followUpQuestionId(type);
      const fu = followUpsById.get(id);
      expect(
        fu,
        `follow-up ${id} must exist in packages/content/follow-ups`,
      ).toBeDefined();
      expect(
        fu!.options.some((o) => o.id === 'yes'),
        `follow-up ${id} must offer the 'yes' trigger option`,
      ).toBe(true);
    }
  });

  it('follow-up confirmations carry no scoring weight — a confirmation can never be averaged into a domain score', () => {
    for (const type of RED_FLAG_TYPES) {
      const id = followUpQuestionId(type);
      expect(
        WEIGHTS.indicators.some((ind) => ind.question_id === id),
        `${id} must not appear in the weights table`,
      ).toBe(false);
    }
  });
});
