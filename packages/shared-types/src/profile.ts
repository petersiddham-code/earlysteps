/**
 * Core data model — mirrors product plan §7.
 *
 * Computed profiles are never mutated in place: every new data point triggers a fresh
 * recompute, and prior profiles are retained for trend graphs and clinician reports
 * (CLAUDE.md §7, product plan §8.6).
 */

import type { Domain } from './domains.js';
import type { Confidence, SignLevel, SupportLevel } from './vocabulary.js';

/** One answer to one intake question. */
export interface IntakeResponse {
  child_id: string;
  question_id: string;
  domain: Domain | 'profile' | 'strengths';
  /** Selected option id(s), a slider value, or optional free text. */
  answer: string | string[] | number;
  /** ISO 8601 timestamp of when it was answered. */
  timestamp: string;
}

/** One structured result from an observation activity (product plan §4.2). */
export interface ActivityResult {
  child_id: string;
  activity_id: string;
  age_band: string;
  modality: 'multiple_choice' | 'audio' | 'video' | 'drawing' | 'typing';
  /** Structured response payload — never scored pass/fail, mapped to domain indicators. */
  response_data: Record<string, unknown>;
  timestamp: string;
}

/** A pointer back to the evidence a finding is derived from (no invented claims). */
export interface EvidenceRef {
  source: 'intake' | 'activity';
  /** question_id or activity_id. */
  ref_id: string;
  /** 1-sentence plain-language note using approved vocabulary; optional. */
  note?: string;
}

/** Per-domain finding: level + confidence + the evidence it rests on. */
export interface DomainFinding {
  domain: Domain;
  level: SignLevel;
  /** Raw normalized 0–100 score, retained for audit — NOT shown to caregivers. */
  score: number;
  confidence: Confidence;
  evidence_refs: EvidenceRef[];
  /**
   * How many scored (indicator-bearing, non-uncertain) answers this finding rests on.
   * Optional only because snapshots computed before the minimum-evidence gate (issue #22)
   * lack it — consumers MUST treat absence as 0 (fail closed).
   */
  answered_count?: number;
  /**
   * Minimum-evidence gate (issue #22): false when answered_count is below the per-domain
   * floor (see @earlysteps/scoring-engine evidenceGate). Consumers MUST render the
   * "not enough information yet" state instead of `level`/`score` unless this is
   * strictly `true` — absence (pre-gate snapshots) means insufficient (fail closed).
   */
  sufficient_evidence?: boolean;
}

/** The full per-child domain profile. */
export interface DomainProfile {
  child_id: string;
  computed_at: string;
  findings: DomainFinding[];
}

/** Overall support-level estimate (product plan §8.4). */
export interface SupportLevelEstimate {
  child_id: string;
  level: SupportLevel;
  confidence: Confidence;
  computed_at: string;
}

/**
 * Red-flag trigger types (product plan §4.8 / §8.5). These are evaluated by hard-coded
 * rules INDEPENDENTLY of domain scoring, so one serious sign can never be averaged away.
 */
export const RED_FLAG_TYPES = [
  'loss_of_skills',
  'no_name_response',
  'no_functional_communication',
  'self_injury_risk',
  'severe_feeding',
  'severe_sleep',
  'sudden_behaviour_change',
  'safety_risk',
] as const;
export type RedFlagType = (typeof RED_FLAG_TYPES)[number];

/** Red flags that additionally surface the calm crisis/urgent-care resource block. */
export const URGENT_RED_FLAG_TYPES = [
  'self_injury_risk',
  'safety_risk',
] as const satisfies readonly RedFlagType[];

export interface RedFlag {
  child_id: string;
  type: RedFlagType;
  triggered_at: string;
  /** The evidence that tripped the rule — always traceable. */
  evidence_refs: EvidenceRef[];
  resolved: boolean;
}
