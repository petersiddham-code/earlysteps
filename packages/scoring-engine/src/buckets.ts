import type { SignLevel } from '@earlysteps/shared-types';

/**
 * Domain score buckets (product plan §8.2 / CLAUDE.md §7).
 *
 *   0–33  → Low signs observed
 *   34–66 → Some signs observed
 *   67–100 → Many signs observed
 *
 * DO NOT change these thresholds without an explicit clinical-review sign-off recorded in
 * docs/clinical-review/. They are the line between "begin support" and "seek assessment".
 */
export const SOME_SIGNS_MIN = 34;
export const MANY_SIGNS_MIN = 67;

/** Bucket a normalized 0–100 score into a sign level. Score is rounded first (deterministic). */
export function bucketScore(score: number): SignLevel {
  const s = Math.round(score);
  if (s >= MANY_SIGNS_MIN) return 'many';
  if (s >= SOME_SIGNS_MIN) return 'some';
  return 'low';
}
