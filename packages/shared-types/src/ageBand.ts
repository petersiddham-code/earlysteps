/**
 * Age-band derivation from a child's birth month + year (issue #25).
 *
 * The band is DERIVED, never stored-as-entered: Child Profile Setup captures birth month
 * and year (deliberately not the full date — month granularity is enough for every band
 * boundary while storing less identifying data, per CLAUDE.md's data-minimization stance),
 * and the backend derives the band at read time. A child can therefore age into the next
 * band between sessions and the questionnaire automatically serves the new band's
 * questions. Trend history records which band each screening used (DomainProfileRecord).
 *
 * Boundaries are month-granular and inclusive, mapped from the caregiver-facing labels
 * (product plan §4.1c A–E + young_adult extension):
 *
 *   toddler      12–36 months   (up to and including the 3rd-birthday month)
 *   preschool    37–71 months   (3–5 years, until the 6th-birthday month)
 *   primary      72–155 months  (6–12 years, until the 13th-birthday month)
 *   teen         156–227 months (13–18 years, until the 19th-birthday month)
 *   young_adult  228–311 months (19–25 years, until the 26th-birthday month)
 *
 * The 36-month edge (exactly 3 years) resolves to toddler, matching the "Toddler (12–36
 * months)" label. Changing any of these boundaries is CLINICAL CONTENT (CLAUDE.md §9) —
 * see docs/clinical-review/2026-07-02-birth-date-derived-age-band.md.
 */

import { AGE_BANDS, type AgeBand } from './domains.js';

/** Inclusive month ranges per band — single source of truth for the table above. */
export const AGE_BAND_MONTH_RANGES: Record<AgeBand, { min: number; max: number }> = {
  toddler: { min: 12, max: 36 },
  preschool: { min: 37, max: 71 },
  primary: { min: 72, max: 155 },
  teen: { min: 156, max: 227 },
  young_adult: { min: 228, max: 311 },
};

/** Supported overall range (months): a first birthday through the 26th-birthday month. */
export const MIN_SUPPORTED_AGE_MONTHS = AGE_BAND_MONTH_RANGES.toddler.min;
export const MAX_SUPPORTED_AGE_MONTHS = AGE_BAND_MONTH_RANGES.young_adult.max;

/**
 * Whole months between the birth month and `at`, at month granularity: the exact day is
 * unknown (never captured), so a child born any day of June 2024 is 24 months old for the
 * whole of June 2026. Can be negative for a birth month in the future.
 */
export function ageInMonths(birthMonth: number, birthYear: number, at: Date): number {
  return (at.getFullYear() - birthYear) * 12 + (at.getMonth() + 1 - birthMonth);
}

/** True for a real calendar month+year a living child could have been born in. */
export function isValidBirthMonthYear(birthMonth: number, birthYear: number): boolean {
  return (
    Number.isInteger(birthMonth) &&
    birthMonth >= 1 &&
    birthMonth <= 12 &&
    Number.isInteger(birthYear) &&
    birthYear >= 1900 &&
    birthYear <= 2200
  );
}

/**
 * The age band for a child born in the given month/year, as of `at` (defaults to now).
 * Returns null when the child is outside the supported 12-month–25-year range (or the
 * birth month/year itself is invalid) — callers decide how to handle that: child creation
 * rejects it with a clear message, read paths clamp via deriveAgeBandOrNearest().
 */
export function deriveAgeBand(
  birthMonth: number,
  birthYear: number,
  at: Date = new Date(),
): AgeBand | null {
  if (!isValidBirthMonthYear(birthMonth, birthYear)) return null;
  const months = ageInMonths(birthMonth, birthYear, at);
  for (const band of AGE_BANDS) {
    const { min, max } = AGE_BAND_MONTH_RANGES[band];
    if (months >= min && months <= max) return band;
  }
  return null;
}

/**
 * Like deriveAgeBand(), but clamps out-of-range ages to the nearest supported band
 * (younger than 12 months → toddler, older than 25 years → young_adult). Used on READ
 * paths only, so a child who ages past 25 between sessions still gets a working app
 * (nearest-band questions) instead of a crash; creation-time validation still uses the
 * strict variant.
 */
export function deriveAgeBandOrNearest(
  birthMonth: number,
  birthYear: number,
  at: Date = new Date(),
): AgeBand {
  const band = deriveAgeBand(birthMonth, birthYear, at);
  if (band) return band;
  const months = ageInMonths(birthMonth, birthYear, at);
  return months < MIN_SUPPORTED_AGE_MONTHS ? 'toddler' : 'young_adult';
}
