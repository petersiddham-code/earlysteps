import { describe, it, expect } from 'vitest';
import type { IntakeResponse } from '@earlysteps/shared-types';
import {
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

  it('loss of skills triggers on the placeholder question = yes', () => {
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

  it('self-injury risk triggers on the placeholder question', () => {
    expect(checkSelfInjuryRisk([r(RF_SELF_INJURY_Q, 'yes')])).toHaveLength(1);
    expect(checkSelfInjuryRisk([r(RF_SELF_INJURY_Q, 'no')])).toEqual([]);
  });

  it('severe feeding triggers on very picky eating', () => {
    expect(checkSevereFeeding([r('T14', 'very_picky')])).toHaveLength(1);
    expect(checkSevereFeeding([r('P16', 'very_picky')])).toHaveLength(1);
    expect(checkSevereFeeding([r('T14', 'wide_variety')])).toEqual([]);
  });

  it('severe sleep triggers on significant struggles', () => {
    expect(checkSevereSleep([r('T15', 'significant_struggles')])).toHaveLength(1);
    expect(checkSevereSleep([r('T15', 'sleeps_well')])).toEqual([]);
  });

  it('sudden behaviour change and safety risk trigger on their placeholder questions', () => {
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
