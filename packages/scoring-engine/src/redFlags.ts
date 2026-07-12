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
import {
  followUpQuestionId,
  type EvidenceRef,
  type IntakeResponse,
  type RedFlagType,
} from '@earlysteps/shared-types';

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

/** Universal feeding/eating question ids, one per age band (issue #110 — was toddler/preschool-only). */
const SEVERE_FEEDING_QS = ['T14', 'P16', 'PR23', 'TE21', 'YA23'];

/**
 * Severe feeding / growth concern. Triggers only on the explicit "so few foods I worry
 * about their growth or health" option — ordinary picky eating ("very picky") is extremely
 * common and stays a weighted sensory signal, not an escalation (product plan §4.8 "severe").
 */
export function checkSevereFeeding(responses: IntakeResponse[]): EvidenceRef[] {
  const refs: EvidenceRef[] = [];
  for (const questionId of SEVERE_FEEDING_QS) {
    const r = find(responses, questionId);
    if (answerEquals(r, 'so_few_worried_growth')) refs.push(evidence(r!));
  }
  return refs;
}

/** Universal sleep question ids, one per age band (issue #65 — was toddler-only). */
const SEVERE_SLEEP_QS = ['T15', 'P21', 'PR17', 'TE14', 'YA12'];

/** Severe sleep disruption. */
export function checkSevereSleep(responses: IntakeResponse[]): EvidenceRef[] {
  const refs: EvidenceRef[] = [];
  for (const questionId of SEVERE_SLEEP_QS) {
    const r = find(responses, questionId);
    if (answerEquals(r, 'significant_struggles')) refs.push(evidence(r!));
  }
  return refs;
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

/**
 * Confirmed free-text follow-up (issue #26): the response-analysis stage may SUGGEST the
 * `FU_<type>` question (packages/content/follow-ups) after a caregiver typed something in a
 * free-text box, but only the caregiver's own structured 'yes' — a normal IntakeResponse —
 * triggers the flag here. This keeps the rule deterministic: the LLM never fires a flag,
 * and 'no' / 'not_sure' contribute nothing. Evaluated alongside each type's base rule, so a
 * confirmation can never be averaged or reasoned away either.
 */
export function checkFollowUpConfirmed(
  type: RedFlagType,
  responses: IntakeResponse[],
): EvidenceRef[] {
  const r = find(responses, followUpQuestionId(type));
  return answerEquals(r, 'yes') ? [evidence(r!)] : [];
}

/** Combines a type's base rule with its confirmed-follow-up check (either can trigger). */
function withFollowUpConfirmation(
  type: RedFlagType,
  base: (responses: IntakeResponse[]) => EvidenceRef[],
): (responses: IntakeResponse[]) => EvidenceRef[] {
  return (responses) => [...base(responses), ...checkFollowUpConfirmed(type, responses)];
}

/** All rules, in evaluation order. Each is independent of the others and of domain scores. */
export const RED_FLAG_RULES: RedFlagRule[] = (
  [
    { type: 'loss_of_skills', check: checkLossOfSkills },
    { type: 'no_name_response', check: checkNoNameResponse },
    { type: 'no_functional_communication', check: checkNoFunctionalCommunication },
    { type: 'self_injury_risk', check: checkSelfInjuryRisk },
    { type: 'severe_feeding', check: checkSevereFeeding },
    { type: 'severe_sleep', check: checkSevereSleep },
    { type: 'sudden_behaviour_change', check: checkSuddenBehaviourChange },
    { type: 'safety_risk', check: checkSafetyRisk },
  ] satisfies RedFlagRule[]
).map(({ type, check }) => ({ type, check: withFollowUpConfirmation(type, check) }));
