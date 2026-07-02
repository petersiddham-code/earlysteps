import floors from '../thresholds/evidence-floors.json' with { type: 'json' };
import { evidenceFloorsSchema, type EvidenceFloors } from './schema.js';

/**
 * Minimum-evidence floors for the scoring engine's evidence gate (issue #22). Placeholder
 * values — see needs_clinical_signoff and docs/clinical-review/2026-07-02-minimum-evidence-gate.md.
 */
export const EVIDENCE_FLOORS: EvidenceFloors = evidenceFloorsSchema.parse(floors);
