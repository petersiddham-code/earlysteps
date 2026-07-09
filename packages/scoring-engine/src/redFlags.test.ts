import { describe, it, expect } from 'vitest';
import {
  RED_FLAG_TYPES,
  followUpQuestionId,
  type IntakeResponse,
} from '@earlysteps/shared-types';
import {
  checkFollowUpConfirmed,
  checkLossOfSkills,
  checkNoNameResponse,
  checkNoFunctionalCommunication,
  checkSelfInjuryRisk,
  checkSevereFeeding,
  checkSevereSleep,
  checkSuddenBehaviourChange,
  checkSafetyRisk,
  RED_FLAG_RULES,
  RF_LOSS_OF_SKILLS_Q,
  RF_SELF_INJURY_Q,
  RF_SUDDEN_CHANGE_Q,
  RF_SAFETY_Q,
} from './redFlags.js';

function r(question_id: string, answer: IntakeResponse['answer']): IntakeResponse {
  return { child_id: 'c1', question_id, domain: 'communication', answer, timestamp: 't' };
}

describe('red-flag rules — each independent and traceable (product plan §8.5)', () => {
  it('free-text entries can never trip a rule, even if the typed words echo a trigger id', () => {
    // "yes" typed as a caregiver note is namespaced free_text:yes — not the option id "yes".
    expect(checkLossOfSkills([r(RF_LOSS_OF_SKILLS_Q, ['no', 'free_text:yes'])])).toEqual(
      [],
    );
    expect(
      checkNoNameResponse([r('T4', ['looks_right_away', 'free_text:doesnt_notice'])]),
    ).toEqual([]);
  });

  it('loss of skills triggers on the universal red-flag question = yes', () => {
    expect(checkLossOfSkills([r(RF_LOSS_OF_SKILLS_Q, 'yes')])).toHaveLength(1);
    expect(checkLossOfSkills([r(RF_LOSS_OF_SKILLS_Q, 'no')])).toEqual([]);
    expect(checkLossOfSkills([])).toEqual([]);
  });

  it('no name response triggers on toddler and preschool worst options', () => {
    expect(checkNoNameResponse([r('T4', 'doesnt_notice')])).toHaveLength(1);
    expect(checkNoNameResponse([r('P5', 'rarely_responds')])).toHaveLength(1);
    expect(checkNoNameResponse([r('T4', 'looks_right_away')])).toEqual([]);
  });

  it('no functional communication needs both no words AND no gestures (toddler)', () => {
    expect(
      checkNoFunctionalCommunication([r('T2', 'none_yet'), r('T3', 'rarely')]),
    ).toHaveLength(2);
    // No words but gesturing to communicate → not triggered.
    expect(
      checkNoFunctionalCommunication([r('T2', 'none_yet'), r('T3', 'yes_often')]),
    ).toEqual([]);
    // Preschool not-yet-talking triggers on its own.
    expect(checkNoFunctionalCommunication([r('P1', 'not_yet_talking')])).toHaveLength(1);
  });

  it('self-injury risk triggers on the universal red-flag question', () => {
    expect(checkSelfInjuryRisk([r(RF_SELF_INJURY_Q, 'yes')])).toHaveLength(1);
    expect(checkSelfInjuryRisk([r(RF_SELF_INJURY_Q, 'no')])).toEqual([]);
  });

  it('severe feeding triggers only on the explicit growth-worry option, not ordinary pickiness', () => {
    expect(checkSevereFeeding([r('T14', 'so_few_worried_growth')])).toHaveLength(1);
    expect(checkSevereFeeding([r('P16', 'so_few_worried_growth')])).toHaveLength(1);
    expect(checkSevereFeeding([r('T14', 'very_picky')])).toEqual([]);
    expect(checkSevereFeeding([r('T14', 'wide_variety')])).toEqual([]);
  });

  it("severe sleep triggers on significant struggles, on every age band's sleep question (#65)", () => {
    for (const questionId of ['T15', 'P21', 'PR17', 'TE14', 'YA12']) {
      expect(checkSevereSleep([r(questionId, 'significant_struggles')])).toHaveLength(1);
      expect(checkSevereSleep([r(questionId, 'sleeps_well')])).toEqual([]);
    }
    expect(checkSevereSleep([])).toEqual([]);
  });

  it('sudden behaviour change and safety risk trigger on their universal questions', () => {
    expect(checkSuddenBehaviourChange([r(RF_SUDDEN_CHANGE_Q, 'yes')])).toHaveLength(1);
    expect(checkSafetyRisk([r(RF_SAFETY_Q, 'yes')])).toHaveLength(1);
  });

  it('exposes all eight rules', () => {
    expect(RED_FLAG_RULES.map((rule) => rule.type)).toEqual([
      'loss_of_skills',
      'no_name_response',
      'no_functional_communication',
      'self_injury_risk',
      'severe_feeding',
      'severe_sleep',
      'sudden_behaviour_change',
      'safety_risk',
    ]);
  });
});

describe('confirmed free-text follow-ups (issue #26) — caregiver answer decides, never the LLM', () => {
  const rulesByType = new Map(RED_FLAG_RULES.map((rule) => [rule.type, rule]));

  it.each([...RED_FLAG_TYPES])(
    "every type triggers on FU_%s = 'yes' with evidence pointing at the follow-up question",
    (type) => {
      const rule = rulesByType.get(type)!;
      const refs = rule.check([r(followUpQuestionId(type), 'yes')]);
      expect(refs).toEqual([{ source: 'intake', ref_id: followUpQuestionId(type) }]);
    },
  );

  it.each([...RED_FLAG_TYPES])(
    "FU_%s answered 'no' or 'not_sure' contributes nothing",
    (type) => {
      const rule = rulesByType.get(type)!;
      expect(rule.check([r(followUpQuestionId(type), 'no')])).toEqual([]);
      expect(rule.check([r(followUpQuestionId(type), 'not_sure')])).toEqual([]);
    },
  );

  it('a free-text echo of a confirmation can never trigger — only the structured answer counts', () => {
    expect(
      checkFollowUpConfirmed('loss_of_skills', [
        r(followUpQuestionId('loss_of_skills'), ['no', 'free_text:yes']),
      ]),
    ).toEqual([]);
  });

  it('a confirmed follow-up combines with (not replaces) the base rule evidence', () => {
    const rule = rulesByType.get('loss_of_skills')!;
    const refs = rule.check([
      r(RF_LOSS_OF_SKILLS_Q, 'yes'),
      r(followUpQuestionId('loss_of_skills'), 'yes'),
    ]);
    expect(refs.map((ref) => ref.ref_id)).toEqual([
      RF_LOSS_OF_SKILLS_Q,
      followUpQuestionId('loss_of_skills'),
    ]);
  });

  it('base rules still fire without any follow-up present (stage is purely additive)', () => {
    const rule = rulesByType.get('safety_risk')!;
    expect(rule.check([r(RF_SAFETY_Q, 'yes')])).toHaveLength(1);
  });
});
