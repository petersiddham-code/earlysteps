/**
 * Boot-time enforcement of CLAUDE.md §9: several content files (scoring weights, evidence
 * floors, result copy, etc.) still carry `needs_clinical_signoff: true` — the app is not
 * safe for a real family until an advisor reviews and clears them (issue #129). Until now
 * that was only a JSON field and a doc comment; this makes it impossible to accidentally
 * boot a production instance while it's still true. Dev/test/CI are unaffected — they get a
 * loud warning instead of a hard failure, so local work and CI aren't blocked on a decision
 * that needs a clinician, not an engineer.
 */
import type { ClinicalSignoffStatus } from '@earlysteps/content';

export function clinicalContentGateMessage(unsignedOff: ClinicalSignoffStatus[]): string {
  const summary = unsignedOff.map((c) => `${c.key}@${c.version}`).join(', ');
  return (
    `Clinical content pending advisor sign-off (CLAUDE.md §9): ${summary}. ` +
    'See docs/clinical-review/content-gaps.md.'
  );
}

/**
 * Throws in production when any content is still unsigned-off; otherwise logs a warning
 * (or does nothing, once every file is actually signed off). `unsignedOff` is a parameter
 * rather than read internally so this stays a pure function callers can unit test without
 * mocking @earlysteps/content.
 */
export function assertClinicalContentSafeToBoot(
  env: string | undefined,
  unsignedOff: ClinicalSignoffStatus[],
  warn: (message: string) => void = console.warn,
): void {
  if (unsignedOff.length === 0) return;

  const message = clinicalContentGateMessage(unsignedOff);
  if (env === 'production') {
    throw new Error(`Refusing to start in production: ${message}`);
  }
  warn(`[clinical-content-gate] NOT SAFE FOR REAL FAMILIES YET — ${message}`);
}
