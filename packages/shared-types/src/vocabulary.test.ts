import { describe, it, expect } from 'vitest';
import {
  containsUnsafeResultLanguage,
  containsBannedOrReservedLanguage,
  containsProfessionalReferralLanguage,
  AI_LIKELIHOOD_LEVELS,
  AI_LIKELIHOOD_TO_LABEL,
  UNCERTAINTY_FACTORS,
  UNCERTAINTY_FACTOR_LABELS,
  COMPARISON_STATUSES,
  COMPARISON_STATUS_LABELS,
  COMPARISON_REASONS,
  COMPARISON_REASON_LABELS,
  RISK_BANDS,
} from './vocabulary.js';

describe('containsUnsafeResultLanguage (issue #104)', () => {
  it('flags a banned word', () => {
    expect(containsUnsafeResultLanguage('This seems abnormal for their age.')).toBe(true);
  });

  it('flags a reserved sign-level label', () => {
    expect(containsUnsafeResultLanguage('Overall, Low signs observed here.')).toBe(true);
  });

  it('flags a reserved support-level term', () => {
    expect(containsUnsafeResultLanguage('This suggests mild support needs.')).toBe(true);
  });

  it('flags a reserved recommendation tier', () => {
    expect(
      containsUnsafeResultLanguage('Formal assessment is recommended based on this.'),
    ).toBe(true);
  });

  it('allows plain, respectful observation text', () => {
    expect(
      containsUnsafeResultLanguage('Enjoys back-and-forth play with familiar adults.'),
    ).toBe(false);
  });

  // Issue #104 QA (PR #105): a model can suggest seeing a professional without ever
  // using a reserved label, and that reads as a second, competing recommendation too.
  it.each([
    'These details deserve follow-up with a professional.',
    'This is worth discussing with a healthcare provider.',
    'A professional should hear about this sooner rather than later.',
    'A professional can offer practical strategies for this.',
    "It may help to mention this to the child's pediatrician.",
    'A specialist could offer more guidance here.',
  ])('flags professional-referral language: %s', (text) => {
    expect(containsUnsafeResultLanguage(text)).toBe(true);
  });
});

// Dual-assessment update (issue #104 v2): containsUnsafeResultLanguage was split into two
// composable checks so professionalAssessmentPriorities can be exempted from just the
// referral-topic half. This regression-guards that the combined function's behavior is
// unchanged after the split.
describe('containsUnsafeResultLanguage composability (dual-assessment update)', () => {
  it('is exactly the OR of its two halves for banned/reserved text', () => {
    const text = 'This seems abnormal for their age.';
    expect(containsBannedOrReservedLanguage(text)).toBe(true);
    expect(containsProfessionalReferralLanguage(text)).toBe(false);
    expect(containsUnsafeResultLanguage(text)).toBe(true);
  });

  it('is exactly the OR of its two halves for professional-referral text', () => {
    const text = 'A specialist could offer more guidance here.';
    expect(containsBannedOrReservedLanguage(text)).toBe(false);
    expect(containsProfessionalReferralLanguage(text)).toBe(true);
    expect(containsUnsafeResultLanguage(text)).toBe(true);
  });

  it('is false when both halves are false', () => {
    const text = 'Enjoys back-and-forth play with familiar adults.';
    expect(containsBannedOrReservedLanguage(text)).toBe(false);
    expect(containsProfessionalReferralLanguage(text)).toBe(false);
    expect(containsUnsafeResultLanguage(text)).toBe(false);
  });
});

describe('Assessment B / comparison vocabulary label maps (issue #104 v2, CLAUDE.md §13)', () => {
  it('AI_LIKELIHOOD_TO_LABEL has exactly one entry per AI_LIKELIHOOD_LEVELS member', () => {
    expect(Object.keys(AI_LIKELIHOOD_TO_LABEL).sort()).toEqual(
      [...AI_LIKELIHOOD_LEVELS].sort(),
    );
  });

  it('UNCERTAINTY_FACTOR_LABELS has exactly one entry per UNCERTAINTY_FACTORS member', () => {
    expect(Object.keys(UNCERTAINTY_FACTOR_LABELS).sort()).toEqual(
      [...UNCERTAINTY_FACTORS].sort(),
    );
  });

  it('COMPARISON_STATUS_LABELS has exactly one entry per COMPARISON_STATUSES member', () => {
    expect(Object.keys(COMPARISON_STATUS_LABELS).sort()).toEqual(
      [...COMPARISON_STATUSES].sort(),
    );
  });

  it('COMPARISON_REASON_LABELS has exactly one entry per COMPARISON_REASONS member', () => {
    expect(Object.keys(COMPARISON_REASON_LABELS).sort()).toEqual(
      [...COMPARISON_REASONS].sort(),
    );
  });

  it('RISK_BANDS has exactly three bands', () => {
    expect(RISK_BANDS).toEqual(['low', 'medium', 'high']);
  });
});
