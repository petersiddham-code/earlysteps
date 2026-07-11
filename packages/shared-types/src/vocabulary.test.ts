import { describe, it, expect } from 'vitest';
import { containsUnsafeResultLanguage } from './vocabulary.js';

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
});
