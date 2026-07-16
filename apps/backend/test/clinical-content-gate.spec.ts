import { describe, it, expect, vi } from 'vitest';
import type { ClinicalSignoffStatus } from '@earlysteps/content';
import {
  assertClinicalContentSafeToBoot,
  clinicalContentGateMessage,
} from '../src/startup/clinical-content-gate.js';

const PENDING: ClinicalSignoffStatus[] = [
  { key: 'weights', version: '0.14.0-placeholder', needs_signoff: true },
  { key: 'evidence-floors', version: '0.3.0-placeholder', needs_signoff: true },
];

describe('assertClinicalContentSafeToBoot (issue #129)', () => {
  it('throws in production when clinical content is still pending sign-off', () => {
    expect(() =>
      assertClinicalContentSafeToBoot('production', PENDING, () => {}),
    ).toThrow(/Refusing to start in production/);
  });

  it('names every pending item in the thrown message', () => {
    try {
      assertClinicalContentSafeToBoot('production', PENDING, () => {});
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Error).message).toContain('weights@0.14.0-placeholder');
      expect((err as Error).message).toContain('evidence-floors@0.3.0-placeholder');
    }
  });

  it('does not throw in production once nothing is pending sign-off', () => {
    expect(() =>
      assertClinicalContentSafeToBoot('production', [], () => {}),
    ).not.toThrow();
  });

  it.each([undefined, 'development', 'test', 'staging'])(
    'warns but does not throw outside production (env=%s)',
    (env) => {
      const warn = vi.fn();
      expect(() => assertClinicalContentSafeToBoot(env, PENDING, warn)).not.toThrow();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0][0]).toContain('NOT SAFE FOR REAL FAMILIES YET');
    },
  );

  it('does not warn when nothing is pending sign-off, regardless of env', () => {
    const warn = vi.fn();
    assertClinicalContentSafeToBoot('development', [], warn);
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('clinicalContentGateMessage', () => {
  it('formats a comma-joined key@version summary', () => {
    expect(clinicalContentGateMessage(PENDING)).toBe(
      'Clinical content pending advisor sign-off (CLAUDE.md §9): ' +
        'weights@0.14.0-placeholder, evidence-floors@0.3.0-placeholder. ' +
        'See docs/clinical-review/content-gaps.md.',
    );
  });
});
