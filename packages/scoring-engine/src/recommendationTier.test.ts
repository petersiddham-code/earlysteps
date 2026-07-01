import { describe, it, expect } from 'vitest';
import type { RedFlag, SupportLevelEstimate } from '@earlysteps/shared-types';
import { deriveRecommendationTier } from './recommendationTier.js';

const AT = '2026-07-01T00:00:00.000Z';

function flag(type: RedFlag['type']): RedFlag {
  return { child_id: 'c1', type, triggered_at: AT, evidence_refs: [], resolved: false };
}

function estimate(level: SupportLevelEstimate['level']): SupportLevelEstimate {
  return { child_id: 'c1', level, confidence: 'medium', computed_at: AT };
}

describe('deriveRecommendationTier', () => {
  it('recommends begin-now with no red flags and a mild/moderate estimate', () => {
    expect(deriveRecommendationTier([], estimate('mild'))).toBe(
      'Support activities can begin now',
    );
    expect(deriveRecommendationTier([], estimate('moderate'))).toBe(
      'Support activities can begin now',
    );
  });

  it('recommends begin-now with no red flags and no estimate at all', () => {
    expect(deriveRecommendationTier([], null)).toBe('Support activities can begin now');
  });

  it('recommends assessment when a high support estimate exists even with no red flags', () => {
    expect(deriveRecommendationTier([], estimate('high'))).toBe(
      'Formal assessment is recommended',
    );
  });

  it('recommends assessment for a non-urgent red flag regardless of support level', () => {
    expect(deriveRecommendationTier([flag('no_name_response')], estimate('mild'))).toBe(
      'Formal assessment is recommended',
    );
  });

  it('strongly recommends soon for an urgent red flag (self-injury), overriding a mild estimate', () => {
    expect(deriveRecommendationTier([flag('self_injury_risk')], estimate('mild'))).toBe(
      'Formal assessment strongly recommended soon',
    );
  });

  it('strongly recommends soon for a safety-risk red flag', () => {
    expect(deriveRecommendationTier([flag('safety_risk')], null)).toBe(
      'Formal assessment strongly recommended soon',
    );
  });

  it('prioritizes the urgent tier when both urgent and non-urgent flags are present', () => {
    const flags = [flag('no_name_response'), flag('self_injury_risk')];
    expect(deriveRecommendationTier(flags, estimate('high'))).toBe(
      'Formal assessment strongly recommended soon',
    );
  });
});
