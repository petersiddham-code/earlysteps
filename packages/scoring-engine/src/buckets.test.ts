import { describe, it, expect } from 'vitest';
import { bucketScore, SOME_SIGNS_MIN, MANY_SIGNS_MIN } from './buckets.js';

describe('bucketScore — every threshold boundary (product plan §8.2)', () => {
  it('buckets the low band', () => {
    expect(bucketScore(0)).toBe('low');
    expect(bucketScore(33)).toBe('low');
  });

  it('buckets the some band', () => {
    expect(bucketScore(34)).toBe('some');
    expect(bucketScore(50)).toBe('some');
    expect(bucketScore(66)).toBe('some');
  });

  it('buckets the many band', () => {
    expect(bucketScore(67)).toBe('many');
    expect(bucketScore(100)).toBe('many');
  });

  it('rounds fractional scores before bucketing', () => {
    expect(bucketScore(33.4)).toBe('low'); // rounds to 33
    expect(bucketScore(33.5)).toBe('some'); // rounds to 34
    expect(bucketScore(66.4)).toBe('some'); // rounds to 66
    expect(bucketScore(66.5)).toBe('many'); // rounds to 67
  });

  it('keeps the documented threshold constants', () => {
    expect(SOME_SIGNS_MIN).toBe(34);
    expect(MANY_SIGNS_MIN).toBe(67);
  });
});
