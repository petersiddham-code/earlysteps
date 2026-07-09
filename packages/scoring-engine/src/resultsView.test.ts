/**
 * Unit tests for toResultsView — the single mapper every results consumer goes through
 * (both the backend's persisted pipeline and mobile's guest/ephemeral pipeline, #63).
 * Pins the 0-answers wire shape reported in issue #32: a profile with no findings must
 * never reach a caregiver as "Support activities can begin now".
 */
import { describe, it, expect } from 'vitest';
import type { DomainProfile, RedFlag } from '@earlysteps/shared-types';
import { toResultsView } from './resultsView.js';

const COMPUTED_AT = '2026-07-02T00:00:00.000Z';

function emptyProfile(): DomainProfile {
  return { child_id: 'c1', computed_at: COMPUTED_AT, findings: [] };
}

const DOMAIN_CYCLE = ['social', 'communication', 'sensory', 'attention'] as const;

function scoredProfile(answeredPerDomain: number, domains = 4): DomainProfile {
  return {
    child_id: 'c1',
    computed_at: COMPUTED_AT,
    findings: Array.from({ length: domains }, (_, i) => ({
      domain: DOMAIN_CYCLE[i % DOMAIN_CYCLE.length]!,
      level: 'low' as const,
      score: 10,
      confidence: 'medium' as const,
      evidence_refs: [],
      answered_count: answeredPerDomain,
      sufficient_evidence: true,
    })),
  };
}

const LOSS_OF_SKILLS_FLAG: RedFlag = {
  child_id: 'c1',
  type: 'loss_of_skills',
  triggered_at: COMPUTED_AT,
  evidence_refs: [{ source: 'intake', ref_id: 'T2' }],
  resolved: false,
};

describe('toResultsView with zero answered questions (issue #32)', () => {
  it('returns no domains, no support level, no recommendation tier — gated overall', () => {
    const view = toResultsView(emptyProfile(), null, [], 0);

    expect(view.domains).toEqual([]);
    expect(view.supportLevel).toBeNull();
    expect(view.recommendationTier).toBeNull();
    expect(view.recommendationConfidence).toBeNull();
    expect(view.insufficientEvidenceOverall).toBe(true);
    expect(view.basedOnAnswers).toBe(0);
  });

  it('re-gates a stale stored estimate: even a persisted support estimate cannot surface a tier off empty findings', () => {
    const staleEstimate = {
      child_id: 'c1',
      level: 'mild' as const,
      confidence: 'low' as const,
      computed_at: COMPUTED_AT,
    };
    const view = toResultsView(emptyProfile(), staleEstimate, [], 0);

    expect(view.supportLevel).toBeNull();
    expect(view.recommendationTier).toBeNull();
    expect(view.recommendationConfidence).toBeNull();
  });

  it('red flags stay exempt: a flag forces its recommendation even with no scored domains', () => {
    const view = toResultsView(emptyProfile(), null, [LOSS_OF_SKILLS_FLAG], 1);

    expect(view.domains).toEqual([]);
    expect(view.redFlagTypes).toEqual(['loss_of_skills']);
    expect(view.recommendationTier).toBe('Formal assessment is recommended');
    // Issue #64: a red-flag-forced recommendation always reports high confidence — a
    // direct rule match on an explicit answer, never diluted by thin domain evidence.
    expect(view.recommendationConfidence).toBe('high');
  });
});

describe('toResultsView above the evidence floor', () => {
  it('passes the tier through once the overall floor is met', () => {
    // 4 domains × 3 answers = 12 ≥ the overall floor of 10.
    const estimate = {
      child_id: 'c1',
      level: 'mild' as const,
      confidence: 'medium' as const,
      computed_at: COMPUTED_AT,
    };
    const view = toResultsView(scoredProfile(3), estimate, [], 12);

    expect(view.insufficientEvidenceOverall).toBe(false);
    expect(view.supportLevel).toEqual({
      term: 'mild support needs',
      confidence: 'medium',
    });
    expect(view.recommendationTier).toBe('Support activities can begin now');
    // Issue #64: with no red flags, the recommendation's confidence matches the
    // support estimate's own confidence — the same number shown next to supportLevel.
    expect(view.recommendationConfidence).toBe('medium');
  });
});
