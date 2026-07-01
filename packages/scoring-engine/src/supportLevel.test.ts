import { describe, it, expect } from 'vitest';
import type { Domain } from '@earlysteps/shared-types';
import { combineConfidence, estimateSupportLevel } from './supportLevel.js';
import type { DomainScore } from './scoreDomain.js';
import { bucketScore } from './buckets.js';

function ds(domain: Domain, score: number): DomainScore {
  return {
    domain,
    score,
    level: bucketScore(score),
    answeredCount: 3,
    evidence_refs: [],
  };
}

describe('estimateSupportLevel — biased weighting (product plan §8.4)', () => {
  it('returns null with no domain scores', () => {
    expect(estimateSupportLevel([])).toBeNull();
  });

  it('maps a uniform moderate profile to moderate support needs', () => {
    const est = estimateSupportLevel([ds('communication', 40), ds('attention', 40)]);
    expect(est?.level).toBe('moderate');
  });

  it('weights social + repetitive behaviour more heavily than other domains', () => {
    const biased = estimateSupportLevel([
      ds('social', 80),
      ds('repetitive_behaviour', 80),
      ds('communication', 0),
    ])!;
    const plainAverage = (80 + 80 + 0) / 3;
    // Bias toward the two high heavy-weight domains lifts the estimate above a flat mean.
    expect(biased.weightedScore).toBeGreaterThan(plainAverage);
  });

  it('nudges up when daily-living/independence shows many signs', () => {
    const est = estimateSupportLevel([ds('social', 60), ds('daily_living', 70)])!;
    // 60*2 + 70*1 = 190 / 3 = 63.33, +10 daily-living cross-check = 73.33 → high.
    expect(est.weightedScore).toBeGreaterThan(66);
    expect(est.level).toBe('high');
  });

  it('maps a low profile to mild support needs', () => {
    expect(estimateSupportLevel([ds('social', 10), ds('sensory', 20)])?.level).toBe(
      'mild',
    );
  });
});

describe('combineConfidence — weakest-link', () => {
  it('is low if any input is low', () => {
    expect(combineConfidence(['high', 'low', 'high'])).toBe('low');
  });
  it('is medium if any input is medium and none low', () => {
    expect(combineConfidence(['high', 'medium'])).toBe('medium');
  });
  it('is high only if all are high', () => {
    expect(combineConfidence(['high', 'high'])).toBe('high');
  });
  it('is low when empty', () => {
    expect(combineConfidence([])).toBe('low');
  });
});
