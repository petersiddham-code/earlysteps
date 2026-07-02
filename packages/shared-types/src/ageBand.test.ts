/**
 * Boundary tests for age-band derivation (issue #25). Every band edge is asserted from
 * both sides — the derived band decides which question bank a child gets, so an
 * off-by-one here silently serves the wrong screening questions.
 */
import { describe, it, expect } from 'vitest';
import {
  AGE_BAND_MONTH_RANGES,
  ageInMonths,
  deriveAgeBand,
  deriveAgeBandOrNearest,
  isValidBirthMonthYear,
} from './ageBand.js';
import { AGE_BANDS } from './domains.js';

/** Fixed "now": July 2026 (month 7). */
const AT = new Date(2026, 6, 15);

/** A birth month/year exactly `months` old at AT, at month granularity. */
function bornMonthsAgo(months: number): { month: number; year: number } {
  const total = 2026 * 12 + 7 - 1 - months; // zero-based absolute month index
  return { month: (total % 12) + 1, year: Math.floor(total / 12) };
}

describe('ageInMonths', () => {
  it('is month-granular: same calendar month = 0, regardless of day', () => {
    expect(ageInMonths(7, 2026, AT)).toBe(0);
  });

  it('counts whole months across year boundaries', () => {
    expect(ageInMonths(6, 2024, AT)).toBe(25);
    expect(ageInMonths(12, 2025, AT)).toBe(7);
  });

  it('bornMonthsAgo helper round-trips through ageInMonths', () => {
    for (const m of [0, 11, 12, 36, 37, 155, 311, 312]) {
      const { month, year } = bornMonthsAgo(m);
      expect(ageInMonths(month, year, AT)).toBe(m);
    }
  });
});

describe('deriveAgeBand — every band boundary, both sides', () => {
  const cases: Array<[number, string | null]> = [
    [11, null], // under 12 months: not yet supported
    [12, 'toddler'], // first supported month
    [36, 'toddler'], // exactly 3 years resolves to toddler ("12–36 months" label)
    [37, 'preschool'],
    [71, 'preschool'],
    [72, 'primary'], // 6th birthday month
    [155, 'primary'],
    [156, 'teen'], // 13th birthday month
    [227, 'teen'],
    [228, 'young_adult'], // 19th birthday month
    [311, 'young_adult'], // last supported month (25 years)
    [312, null], // 26th birthday month: aged out
  ];

  it.each(cases)('%s months old → %s', (months, expected) => {
    const { month, year } = bornMonthsAgo(months);
    expect(deriveAgeBand(month, year, AT)).toBe(expected);
  });

  it('the ranges tile the supported span with no gaps or overlaps', () => {
    let expectedMin = 12;
    for (const band of AGE_BANDS) {
      const { min, max } = AGE_BAND_MONTH_RANGES[band];
      expect(min).toBe(expectedMin);
      expect(max).toBeGreaterThanOrEqual(min);
      expectedMin = max + 1;
    }
  });

  it('rejects impossible birth months/years rather than deriving nonsense', () => {
    expect(deriveAgeBand(0, 2024, AT)).toBeNull();
    expect(deriveAgeBand(13, 2024, AT)).toBeNull();
    expect(deriveAgeBand(2.5, 2024, AT)).toBeNull();
    expect(deriveAgeBand(6, 1899, AT)).toBeNull();
    expect(deriveAgeBand(6, 2028, AT)).toBeNull(); // born in the future
  });
});

describe('deriveAgeBandOrNearest — read-path clamping', () => {
  it('matches deriveAgeBand inside the supported range', () => {
    for (const months of [12, 36, 37, 227, 311]) {
      const { month, year } = bornMonthsAgo(months);
      expect(deriveAgeBandOrNearest(month, year, AT)).toBe(
        deriveAgeBand(month, year, AT),
      );
    }
  });

  it('clamps a not-yet-12-months child to toddler instead of crashing reads', () => {
    const { month, year } = bornMonthsAgo(11);
    expect(deriveAgeBandOrNearest(month, year, AT)).toBe('toddler');
  });

  it('clamps a child who aged past 25 to young_adult so the app keeps working', () => {
    const { month, year } = bornMonthsAgo(312);
    expect(deriveAgeBandOrNearest(month, year, AT)).toBe('young_adult');
  });
});

describe('isValidBirthMonthYear', () => {
  it('accepts real calendar months', () => {
    expect(isValidBirthMonthYear(1, 2024)).toBe(true);
    expect(isValidBirthMonthYear(12, 2001)).toBe(true);
  });

  it('rejects out-of-range or non-integer input', () => {
    expect(isValidBirthMonthYear(0, 2024)).toBe(false);
    expect(isValidBirthMonthYear(13, 2024)).toBe(false);
    expect(isValidBirthMonthYear(6, 1899)).toBe(false);
    expect(isValidBirthMonthYear(6.5, 2024)).toBe(false);
    expect(isValidBirthMonthYear(6, NaN)).toBe(false);
  });
});
