import { describe, it, expect } from 'vitest';
import type { RedFlag, SupportLevelEstimate } from '@earlysteps/shared-types';
import {
  deriveRecommendationConfidence,
  deriveRecommendationTier,
} from './recommendationTier.js';

const AT = '2026-07-01T00:00:00.000Z';

function flag(type: RedFlag['type']): RedFlag {
  return { child_id: 'c1', type, triggered_at: AT, evidence_refs: [], resolved: false };
}

function estimate(level: SupportLevelEstimate['level']): SupportLevelEstimate {
  return { child_id: 'c1', level, confidence: 'medium', computed_at: AT };
}

describe('deriveRecommendationTier', () => {
  it('recommends begin-now with no red flags and a mild/moderate estimate', () => {
    expect(deriveRecommendationTier([], estimate('mild'), true)).toBe(
      'Support activities can begin now',
    );
    expect(deriveRecommendationTier([], estimate('moderate'), true)).toBe(
      'Support activities can begin now',
    );
  });

  it('recommends begin-now with no red flags and no estimate at all (evidence sufficient)', () => {
    expect(deriveRecommendationTier([], null, true)).toBe(
      'Support activities can begin now',
    );
  });

  it('recommends assessment when a high support estimate exists even with no red flags', () => {
    expect(deriveRecommendationTier([], estimate('high'), true)).toBe(
      'Formal assessment is recommended',
    );
  });

  it('recommends assessment for a non-urgent red flag regardless of support level', () => {
    expect(
      deriveRecommendationTier([flag('no_name_response')], estimate('mild'), true),
    ).toBe('Formal assessment is recommended');
  });

  it('strongly recommends soon for an urgent red flag (self-injury), overriding a mild estimate', () => {
    expect(
      deriveRecommendationTier([flag('self_injury_risk')], estimate('mild'), true),
    ).toBe('Formal assessment strongly recommended soon');
  });

  it('strongly recommends soon for a safety-risk red flag', () => {
    expect(deriveRecommendationTier([flag('safety_risk')], null, true)).toBe(
      'Formal assessment strongly recommended soon',
    );
  });

  it('prioritizes the urgent tier when both urgent and non-urgent flags are present', () => {
    const flags = [flag('no_name_response'), flag('self_injury_risk')];
    expect(deriveRecommendationTier(flags, estimate('high'), true)).toBe(
      'Formal assessment strongly recommended soon',
    );
  });

  describe('minimum-evidence gate (issue #22)', () => {
    it('returns null with no red flags and insufficient evidence — even begin-now is too strong a claim', () => {
      expect(deriveRecommendationTier([], null, false)).toBeNull();
    });

    it('never lets a stray estimate produce a tier when evidence is insufficient', () => {
      expect(deriveRecommendationTier([], estimate('high'), false)).toBeNull();
    });

    it('red flags are EXEMPT: a non-urgent flag still recommends assessment on insufficient evidence', () => {
      expect(deriveRecommendationTier([flag('no_name_response')], null, false)).toBe(
        'Formal assessment is recommended',
      );
    });

    it('red flags are EXEMPT: an urgent flag still escalates on insufficient evidence', () => {
      expect(deriveRecommendationTier([flag('self_injury_risk')], null, false)).toBe(
        'Formal assessment strongly recommended soon',
      );
    });
  });
});

describe('deriveRecommendationConfidence (issue #64)', () => {
  it('is high for a red flag alone, with no estimate at all', () => {
    expect(deriveRecommendationConfidence([flag('no_name_response')], null)).toBe('high');
  });

  it('is high for a red flag even when the estimate confidence is only medium — a hard rule match beats an averaged estimate', () => {
    expect(
      deriveRecommendationConfidence([flag('self_injury_risk')], estimate('mild')),
    ).toBe('high');
  });

  it('matches the estimate confidence with no red flags, for every confidence level', () => {
    for (const confidence of ['low', 'medium', 'high'] as const) {
      const est: SupportLevelEstimate = { ...estimate('mild'), confidence };
      expect(deriveRecommendationConfidence([], est)).toBe(confidence);
    }
  });

  it('is null with no red flags and no estimate — matches deriveRecommendationTier returning null', () => {
    expect(deriveRecommendationConfidence([], null)).toBeNull();
  });
});
