import { describe, it, expect } from 'vitest';
import { EVIDENCE_FLOORS } from '@earlysteps/content';
import {
  hasSufficientDomainEvidence,
  hasSufficientOverallEvidence,
} from './evidenceGate.js';

const domainFloor = EVIDENCE_FLOORS.min_scored_answers_per_domain;
const overallFloor = EVIDENCE_FLOORS.min_scored_answers_overall;

describe('minimum-evidence gate (issue #22) — floors are clinical placeholders', () => {
  it('ships the floors flagged for clinical sign-off (placeholder values)', () => {
    expect(EVIDENCE_FLOORS.needs_clinical_signoff).toBe(true);
  });

  it('gates a domain below the floor, passes it exactly at the floor (boundary)', () => {
    expect(hasSufficientDomainEvidence(0)).toBe(false);
    expect(hasSufficientDomainEvidence(domainFloor - 1)).toBe(false);
    expect(hasSufficientDomainEvidence(domainFloor)).toBe(true);
    expect(hasSufficientDomainEvidence(domainFloor + 1)).toBe(true);
  });

  it('one answer is never enough for a domain level (the issue #22 headline case)', () => {
    expect(hasSufficientDomainEvidence(1)).toBe(false);
  });

  it('drops the domain floor to the total available, so a fully answered sparse domain is not gated forever', () => {
    expect(hasSufficientDomainEvidence(1, 1)).toBe(true);
    expect(hasSufficientDomainEvidence(2, 2)).toBe(true);
    // Partially answered sparse domain still gated.
    expect(hasSufficientDomainEvidence(1, 2)).toBe(false);
  });

  it('a zero/unknown total falls back to the configured floor (never floor 0)', () => {
    expect(hasSufficientDomainEvidence(domainFloor - 1, 0)).toBe(false);
    expect(hasSufficientDomainEvidence(domainFloor - 1, undefined)).toBe(false);
    expect(hasSufficientDomainEvidence(domainFloor, 0)).toBe(true);
  });

  it('gates the overall estimate below the floor, passes it exactly at the floor (boundary)', () => {
    expect(hasSufficientOverallEvidence(0)).toBe(false);
    expect(hasSufficientOverallEvidence(overallFloor - 1)).toBe(false);
    expect(hasSufficientOverallEvidence(overallFloor)).toBe(true);
  });

  it('overall floor is never below the per-domain floor (coherence, see validateContent)', () => {
    expect(overallFloor).toBeGreaterThanOrEqual(domainFloor);
  });
});
