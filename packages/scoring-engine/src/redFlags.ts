/**
 * Red-flag rules (product plan §4.8 / §8.5, CLAUDE.md §2 rule 8 / §7).
 *
 * These run INDEPENDENTLY of domain scoring — a single serious sign can never be averaged
 * away. Each rule is a small, individually-testable function so it can be reviewed and
 * tuned in isolation. A rule returns the triggering EvidenceRefs (empty array = not
 * triggered); the trigger is always traceable to specific answers, never invented.
 *
 * The RF_* question ids below are asked in the universal bank for every age band
 * (packages/content/questions/universal.json), so these rules run live on every intake.
 * redFlagContentWiring.test.ts asserts each rule's question ids and trigger options exist
 * in the shipped banks, so a content rename can never silently turn a rule inert again.
 */
import type { EvidenceRef, IntakeResponse, RedFlagType } from '@earlysteps/shared-types';

/** Universal-bank red-flag question ids (shared with content — asked for every age band). */
export const RF_LOSS_OF_SKILLS_Q = 'RF_loss_of_skills';
export const RF_SELF_INJURY_Q = 'RF_self_injury';
export const RF_SUDDEN_CHANGE_Q = 'RF_sudden_behaviour_change';
export const RF_SAFETY_Q = 'RF_safety_concern';

function find(
  responses: IntakeResponse[],
  questionId: string,
): IntakeResponse | undefined {
  return responses.find((r) => r.question_id === questionId);
}

function answerEquals(
  response: IntakeResponse | undefined,
  ...values: string[]
): boolean {
  if (!response) return false;
  const a = response.answer;
  if (Array.isArray(a)) return a.some((v) => values.includes(v));
  return values.includes(String(a));
}

function evidence(response: IntakeResponse): EvidenceRef {
  return { source: 'intake', ref_id: response.question_id };
}

export interface RedFlagRule {
  type: RedFlagType;
  check: (responses: IntakeResponse[]) => EvidenceRef[];
}

/** Loss of previously-acquired words/skills — highest-weight NICE regression signal. */
export function checkLossOfSkills(responses: IntakeResponse[]): EvidenceRef[] {
  const r = find(responses, RF_LOSS_OF_SKILLS_Q);
  return answerEquals(r, 'yes') ? [evidence(r!)] : [];
}

/** No response to name after repeated well-conducted attempts. */
export function checkNoNameResponse(responses: IntakeResponse[]): EvidenceRef[] {
  const t4 = find(responses, 'T4');
  const p5 = find(responses, 'P5');
  const refs: EvidenceRef[] = [];
  if (answerEquals(t4, 'doesnt_notice')) refs.push(evidence(t4!));
  if (answerEquals(p5, 'rarely_responds')) refs.push(evidence(p5!));
  return refs;
}

/** No functional communication method at all (words, gestures, or pointing). */
export function checkNoFunctionalCommunication(
  responses: IntakeResponse[],
): EvidenceRef[] {
  const t2 = find(responses, 'T2');
  const t3 = find(responses, 'T3');
  const p1 = find(responses, 'P1');
  const refs: EvidenceRef[] = [];
  // Toddler: no words AND no gesturing to communicate.
  if (answerEquals(t2, 'none_yet') && answerEquals(t3, 'rarely')) {
    refs.push(evidence(t2!), evidence(t3!));
  }
  // Preschool: not yet talking at all.
  if (answerEquals(p1, 'not_yet_talking')) refs.push(evidence(p1!));
  return refs;
}

/** Self-injury risk indicators. */
export function checkSelfInjuryRisk(responses: IntakeResponse[]): EvidenceRef[] {
  const r = find(responses, RF_SELF_INJURY_Q);
  return answerEquals(r, 'yes') ? [evidence(r!)] : [];
}

/**
 * Severe feeding / growth concern. Triggers only on the explicit "so few foods I worry
 * about their growth or health" option — ordinary picky eating ("very picky") is extremely
 * common and stays a weighted sensory signal, not an escalation (product plan §4.8 "severe").
 */
export function checkSevereFeeding(responses: IntakeResponse[]): EvidenceRef[] {
  const t14 = find(responses, 'T14');
  const p16 = find(responses, 'P16');
  const refs: EvidenceRef[] = [];
  if (answerEquals(t14, 'so_few_worried_growth')) refs.push(evidence(t14!));
  if (answerEquals(p16, 'so_few_worried_growth')) refs.push(evidence(p16!));
  return refs;
}

/** Severe sleep disruption. */
export function checkSevereSleep(responses: IntakeResponse[]): EvidenceRef[] {
  const t15 = find(responses, 'T15');
  return answerEquals(t15, 'significant_struggles') ? [evidence(t15!)] : [];
}

/** Sudden significant behaviour change. */
export function checkSuddenBehaviourChange(responses: IntakeResponse[]): EvidenceRef[] {
  const r = find(responses, RF_SUDDEN_CHANGE_Q);
  return answerEquals(r, 'yes') ? [evidence(r!)] : [];
}

/** Any general safety concern. */
export function checkSafetyRisk(responses: IntakeResponse[]): EvidenceRef[] {
  const r = find(responses, RF_SAFETY_Q);
  return answerEquals(r, 'yes') ? [evidence(r!)] : [];
}

/** All rules, in evaluation order. Each is independent of the others and of domain scores. */
export const RED_FLAG_RULES: RedFlagRule[] = [
  { type: 'loss_of_skills', check: checkLossOfSkills },
  { type: 'no_name_response', check: checkNoNameResponse },
  { type: 'no_functional_communication', check: checkNoFunctionalCommunication },
  { type: 'self_injury_risk', check: checkSelfInjuryRisk },
  { type: 'severe_feeding', check: checkSevereFeeding },
  { type: 'severe_sleep', check: checkSevereSleep },
  { type: 'sudden_behaviour_change', check: checkSuddenBehaviourChange },
  { type: 'safety_risk', check: checkSafetyRisk },
];
