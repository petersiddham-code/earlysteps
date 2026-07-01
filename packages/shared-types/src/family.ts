/**
 * Family/child account model — mirrors product plan §7 top-level Family/Children shape.
 */
import type { AgeBand } from './domains.js';
import type { ConsentScope } from './vocabulary.js';

/** Layered consent (product plan §4.7). Absent/false scope = not granted — fail-safe default. */
export type ConsentFlags = Partial<Record<ConsentScope, boolean>>;

export interface Family {
  id: string;
  locale: string;
  low_bandwidth_mode: boolean;
  consent_flags: ConsentFlags;
}

export interface Child {
  id: string;
  family_id: string;
  nickname: string;
  age_band: AgeBand;
  languages: string[];
}
