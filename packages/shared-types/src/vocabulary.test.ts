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
