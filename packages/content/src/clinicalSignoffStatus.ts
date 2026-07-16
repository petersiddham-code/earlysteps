/**
 * Aggregates `needs_clinical_signoff` across every content file that carries it (issue #129).
 * Each of these files is placeholder/unreviewed clinical content until an advisor signs off
 * (CLAUDE.md §9) — this is the single place that knows the full list, so a boot-time gate or
 * an admin view can ask "is anything still unsafe to show a real family" without separately
 * importing and checking eight files by hand.
 */
import { WEIGHTS } from './weights.js';
import { EVIDENCE_FLOORS } from './evidenceFloors.js';
import { RESULT_COPY } from './resultCopy.js';
import { RED_FLAG_COPY } from './redFlagCopy.js';
import { DOMAIN_RESOURCES } from './domainResources.js';
import { FOLLOW_UPS } from './followUps.js';
import { AI_RESULTS_SUMMARY_COPY } from './aiResultsSummaryCopy.js';
import { COMPARISON_COPY } from './comparisonCopy.js';

export interface ClinicalSignoffStatus {
  /** Stable identifier for the content file, e.g. "weights" or "red-flag-copy". */
  key: string;
  version: string;
  needs_signoff: boolean;
}

/** Every content file that declares `needs_clinical_signoff`, current live status. */
export function clinicalSignoffStatus(): ClinicalSignoffStatus[] {
  return [
    {
      key: 'weights',
      version: WEIGHTS.version,
      needs_signoff: WEIGHTS.needs_clinical_signoff,
    },
    {
      key: 'evidence-floors',
      version: EVIDENCE_FLOORS.version,
      needs_signoff: EVIDENCE_FLOORS.needs_clinical_signoff,
    },
    {
      key: 'result-copy',
      version: RESULT_COPY.version,
      needs_signoff: RESULT_COPY.needs_clinical_signoff,
    },
    {
      key: 'red-flag-copy',
      version: RED_FLAG_COPY.version,
      needs_signoff: RED_FLAG_COPY.needs_clinical_signoff,
    },
    {
      key: 'domain-resources',
      version: DOMAIN_RESOURCES.version,
      needs_signoff: DOMAIN_RESOURCES.needs_clinical_signoff,
    },
    {
      key: 'follow-ups',
      version: FOLLOW_UPS.version,
      needs_signoff: FOLLOW_UPS.needs_clinical_signoff,
    },
    {
      key: 'ai-results-summary-copy',
      version: AI_RESULTS_SUMMARY_COPY.version,
      needs_signoff: AI_RESULTS_SUMMARY_COPY.needs_clinical_signoff,
    },
    {
      key: 'comparison-copy',
      version: COMPARISON_COPY.version,
      needs_signoff: COMPARISON_COPY.needs_clinical_signoff,
    },
  ];
}

/** Subset still pending advisor sign-off — what a boot gate or admin warning cares about. */
export function unsignedOffClinicalContent(): ClinicalSignoffStatus[] {
  return clinicalSignoffStatus().filter((status) => status.needs_signoff);
}
