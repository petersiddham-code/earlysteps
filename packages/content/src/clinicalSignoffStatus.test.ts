import { describe, it, expect } from 'vitest';
import {
  clinicalSignoffStatus,
  unsignedOffClinicalContent,
} from './clinicalSignoffStatus.js';

describe('clinicalSignoffStatus', () => {
  it('reports one entry per content file that declares needs_clinical_signoff', () => {
    const statuses = clinicalSignoffStatus();
    expect(statuses.map((s) => s.key).sort()).toEqual([
      'ai-results-summary-copy',
      'comparison-copy',
      'domain-resources',
      'evidence-floors',
      'follow-ups',
      'red-flag-copy',
      'result-copy',
      'weights',
    ]);
    for (const status of statuses) {
      expect(typeof status.version).toBe('string');
      expect(status.version.length).toBeGreaterThan(0);
      expect(typeof status.needs_signoff).toBe('boolean');
    }
  });

  it('unsignedOffClinicalContent only returns entries still pending sign-off', () => {
    const all = clinicalSignoffStatus();
    const pending = unsignedOffClinicalContent();
    expect(pending.every((s) => s.needs_signoff)).toBe(true);
    expect(pending.length).toBeLessThanOrEqual(all.length);
    expect(pending.map((s) => s.key)).toEqual(
      all.filter((s) => s.needs_signoff).map((s) => s.key),
    );
  });

  it('flags weights and evidence-floors as pending — the current real-content state this PR does not change (issue #129)', () => {
    // Regression guard against silently "fixing" the blocker without an actual advisor
    // sign-off: this must stay true until docs/clinical-review/ records real sign-off.
    const pendingKeys = new Set(unsignedOffClinicalContent().map((s) => s.key));
    expect(pendingKeys.has('weights')).toBe(true);
    expect(pendingKeys.has('evidence-floors')).toBe(true);
  });
});
