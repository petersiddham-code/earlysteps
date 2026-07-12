import { describe, it, expect } from 'vitest';
import type {
  AssessmentAComparisonInput,
  AssessmentBComparisonInput,
} from './compareAssessments.js';
import { compareAssessments } from './compareAssessments.js';

const NOW = '2026-07-11T00:00:00.000Z';

/** A "clean" Assessment A input: full evidence, medium tier, no red flags, no gates. */
function assessmentA(
  overrides: Partial<AssessmentAComparisonInput> = {},
): AssessmentAComparisonInput {
  return {
    domains: [
      {
        domain: 'communication',
        status: 'scored',
        label: 'Some signs observed',
        confidence: 'medium',
      },
      {
        domain: 'social',
        status: 'scored',
        label: 'Some signs observed',
        confidence: 'medium',
      },
    ],
    supportLevel: { term: 'moderate support needs', confidence: 'medium' },
    insufficientEvidenceOverall: false,
    redFlagTypes: [],
    recommendationTier: 'Formal assessment is recommended',
    recommendationConfidence: 'medium',
    ...overrides,
  };
}

/** A "clean" Assessment B input: moderate likelihood, medium confidence, no uncertainty. */
function assessmentB(
  overrides: Partial<AssessmentBComparisonInput> = {},
): AssessmentBComparisonInput {
  return {
    likelihood: 'Moderate',
    confidence: 'medium',
    uncertaintyFactors: [],
    ...overrides,
  };
}

describe('compareAssessments — band agreement', () => {
  it('exact band match yields agreement with no reasons', () => {
    const result = compareAssessments(
      assessmentA({ recommendationTier: 'Support activities can begin now' }),
      assessmentB({ likelihood: 'Low' }),
      NOW,
    );
    expect(result.status).toBe('agreement');
    expect(result.reasons).toEqual([]);
    expect(result.assessmentABand).toBe('low');
    expect(result.assessmentBBand).toBe('low');
    expect(result.bandDistance).toBe(0);
  });

  it('band distance of 1 yields partial_agreement', () => {
    const result = compareAssessments(
      assessmentA({ recommendationTier: 'Support activities can begin now' }),
      assessmentB({ likelihood: 'Moderate' }),
      NOW,
    );
    expect(result.status).toBe('partial_agreement');
    expect(result.bandDistance).toBe(1);
  });

  it('band distance of 2 yields disagreement', () => {
    const result = compareAssessments(
      assessmentA({ recommendationTier: 'Support activities can begin now' }),
      assessmentB({ likelihood: 'Very High' }),
      NOW,
    );
    expect(result.status).toBe('disagreement');
    expect(result.bandDistance).toBe(2);
  });

  it('agreement-suppression: reasons stay [] even when B reports uncertainty factors', () => {
    const result = compareAssessments(
      assessmentA({ recommendationTier: 'Support activities can begin now' }),
      assessmentB({ likelihood: 'Low', uncertaintyFactors: ['contradictory_responses'] }),
      NOW,
    );
    expect(result.status).toBe('agreement');
    expect(result.reasons).toEqual([]);
  });
});

describe('compareAssessments — null Assessment A tier (gated/insufficient evidence)', () => {
  it('forces partial_agreement with insufficient_evidence when insufficientEvidenceOverall is true', () => {
    const result = compareAssessments(
      assessmentA({
        insufficientEvidenceOverall: true,
        recommendationTier: null,
        recommendationConfidence: null,
      }),
      assessmentB(),
      NOW,
    );
    expect(result.status).toBe('partial_agreement');
    expect(result.reasons).toEqual(['insufficient_evidence']);
    expect(result.assessmentABand).toBeNull();
    expect(result.bandDistance).toBeNull();
    expect(result.assessmentBBand).toBe('medium');
  });

  it('still surfaces B-reported contradictory_responses/conflicting_developmental_history alongside insufficient_evidence', () => {
    const result = compareAssessments(
      assessmentA({
        insufficientEvidenceOverall: true,
        recommendationTier: null,
        recommendationConfidence: null,
      }),
      assessmentB({
        uncertaintyFactors: [
          'contradictory_responses',
          'conflicting_developmental_history',
        ],
      }),
      NOW,
    );
    expect(result.status).toBe('partial_agreement');
    expect(result.reasons).toEqual([
      'contradictory_responses',
      'conflicting_developmental_history',
      'insufficient_evidence',
    ]);
  });
});

describe('compareAssessments — each of the six reasons individually', () => {
  it('contradictory_responses', () => {
    const result = compareAssessments(
      assessmentA({ recommendationTier: 'Support activities can begin now' }),
      assessmentB({
        likelihood: 'High',
        uncertaintyFactors: ['contradictory_responses'],
      }),
      NOW,
    );
    expect(result.reasons).toContain('contradictory_responses');
  });

  it('conflicting_developmental_history', () => {
    const result = compareAssessments(
      assessmentA({ recommendationTier: 'Support activities can begin now' }),
      assessmentB({
        likelihood: 'High',
        uncertaintyFactors: ['conflicting_developmental_history'],
      }),
      NOW,
    );
    expect(result.reasons).toContain('conflicting_developmental_history');
  });

  it('unsupported_text_evidence, via limited_free_text_evidence', () => {
    const result = compareAssessments(
      assessmentA({ recommendationTier: 'Support activities can begin now' }),
      assessmentB({
        likelihood: 'High',
        uncertaintyFactors: ['limited_free_text_evidence'],
      }),
      NOW,
    );
    expect(result.reasons).toContain('unsupported_text_evidence');
  });

  it('missing_observations, via a gated domain', () => {
    const result = compareAssessments(
      assessmentA({
        recommendationTier: 'Support activities can begin now',
        domains: [
          {
            domain: 'sensory',
            status: 'insufficient_evidence',
            label: 'Not enough information yet',
          },
        ],
      }),
      assessmentB({ likelihood: 'High' }),
      NOW,
    );
    expect(result.reasons).toContain('missing_observations');
  });

  it('low_confidence, via Assessment A recommendationConfidence', () => {
    const result = compareAssessments(
      assessmentA({
        recommendationTier: 'Support activities can begin now',
        recommendationConfidence: 'low',
      }),
      assessmentB({ likelihood: 'High' }),
      NOW,
    );
    expect(result.reasons).toContain('low_confidence');
  });

  it('low_confidence, via Assessment A supportLevel confidence', () => {
    const result = compareAssessments(
      assessmentA({
        recommendationTier: 'Support activities can begin now',
        supportLevel: { term: 'mild support needs', confidence: 'low' },
      }),
      assessmentB({ likelihood: 'High' }),
      NOW,
    );
    expect(result.reasons).toContain('low_confidence');
  });

  it('low_confidence, via Assessment B confidence', () => {
    const result = compareAssessments(
      assessmentA({ recommendationTier: 'Support activities can begin now' }),
      assessmentB({ likelihood: 'High', confidence: 'low' }),
      NOW,
    );
    expect(result.reasons).toContain('low_confidence');
  });

  it('insufficient_evidence (non-null-tier path), via sparse_structured_answers', () => {
    const result = compareAssessments(
      assessmentA({ recommendationTier: 'Support activities can begin now' }),
      assessmentB({
        likelihood: 'High',
        uncertaintyFactors: ['sparse_structured_answers'],
      }),
      NOW,
    );
    expect(result.reasons).toContain('insufficient_evidence');
  });
});

describe('compareAssessments — catch-all fallback', () => {
  it('falls back to unsupported_text_evidence when nothing else explains a mismatch', () => {
    const result = compareAssessments(
      assessmentA({ recommendationTier: 'Support activities can begin now' }),
      assessmentB({ likelihood: 'Moderate' }),
      NOW,
    );
    expect(result.status).toBe('partial_agreement');
    expect(result.reasons).toEqual(['unsupported_text_evidence']);
  });
});

describe('compareAssessments — reason ordering', () => {
  it('orders reasons by fixed priority regardless of trigger order', () => {
    const result = compareAssessments(
      assessmentA({
        recommendationTier: 'Support activities can begin now',
        recommendationConfidence: 'low',
        domains: [
          {
            domain: 'sensory',
            status: 'insufficient_evidence',
            label: 'Not enough information yet',
          },
        ],
      }),
      assessmentB({
        likelihood: 'Very High',
        uncertaintyFactors: [
          'conflicting_developmental_history',
          'contradictory_responses',
        ],
      }),
      NOW,
    );
    expect(result.reasons).toEqual([
      'contradictory_responses',
      'conflicting_developmental_history',
      'missing_observations',
      'low_confidence',
    ]);
  });
});

describe('compareAssessments — red-flag safeguard (CLAUDE.md §2 rule 8)', () => {
  it('narrative always includes the safety note when a red flag is present, even on agreement', () => {
    const result = compareAssessments(
      assessmentA({
        recommendationTier: 'Formal assessment strongly recommended soon',
        redFlagTypes: ['self_injury_risk'],
      }),
      assessmentB({ likelihood: 'High' }),
      NOW,
    );
    expect(result.status).toBe('agreement');
    expect(result.narrative).toContain(
      'A specific serious-sign answer was given directly by the caregiver.',
    );
  });

  it('narrative includes the safety note when bands diverge with a red flag present', () => {
    const result = compareAssessments(
      assessmentA({
        recommendationTier: 'Formal assessment strongly recommended soon',
        redFlagTypes: ['safety_risk'],
      }),
      assessmentB({ likelihood: 'Very Low' }),
      NOW,
    );
    expect(result.status).toBe('disagreement');
    expect(result.narrative).toContain(
      'A specific serious-sign answer was given directly by the caregiver.',
    );
  });

  it('narrative omits the safety note when there is no red flag', () => {
    const result = compareAssessments(assessmentA(), assessmentB(), NOW);
    expect(result.narrative).not.toContain('serious-sign answer');
  });
});

describe('compareAssessments — computedAt', () => {
  it('defaults to the current time when not provided', () => {
    const before = Date.now();
    const result = compareAssessments(assessmentA(), assessmentB());
    const after = Date.now();
    const parsed = Date.parse(result.computedAt);
    expect(parsed).toBeGreaterThanOrEqual(before);
    expect(parsed).toBeLessThanOrEqual(after);
  });
});
