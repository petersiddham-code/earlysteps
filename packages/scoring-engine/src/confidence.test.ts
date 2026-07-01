import { describe, it, expect } from 'vitest';
import { computeConfidence } from './confidence.js';

describe('computeConfidence — separate from score (product plan §8.3)', () => {
  it('caps at low when too few answers, even if complete ratio-wise', () => {
    expect(
      computeConfidence({
        answeredCount: 2,
        totalPossible: 2,
        corroboratingSources: 5,
        consistent: true,
      }),
    ).toBe('low');
  });

  it('caps at low on sparse completeness', () => {
    expect(
      computeConfidence({
        answeredCount: 4,
        totalPossible: 20,
        corroboratingSources: 2,
        consistent: true,
      }),
    ).toBe('low');
  });

  it('is high only with completeness + corroboration + consistency', () => {
    expect(
      computeConfidence({
        answeredCount: 8,
        totalPossible: 10,
        corroboratingSources: 1,
        consistent: true,
      }),
    ).toBe('high');
  });

  it('drops to medium without corroboration', () => {
    expect(
      computeConfidence({
        answeredCount: 8,
        totalPossible: 10,
        corroboratingSources: 0,
        consistent: true,
      }),
    ).toBe('medium');
  });

  it('drops to medium when sources are inconsistent', () => {
    expect(
      computeConfidence({
        answeredCount: 8,
        totalPossible: 10,
        corroboratingSources: 2,
        consistent: false,
      }),
    ).toBe('medium');
  });

  it('is medium for moderate completeness above the sparse floor', () => {
    expect(
      computeConfidence({
        answeredCount: 5,
        totalPossible: 10,
        corroboratingSources: 0,
        consistent: true,
      }),
    ).toBe('medium');
  });

  it('returns low when nothing is answerable', () => {
    expect(
      computeConfidence({
        answeredCount: 0,
        totalPossible: 0,
        corroboratingSources: 0,
        consistent: true,
      }),
    ).toBe('low');
  });
});
