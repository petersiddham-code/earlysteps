/**
 * Family/child account model — mirrors product plan §7 top-level Family/Children shape.
 */
import type { AgeBand } from './domains.js';
import type { ConsentScope } from './vocabulary.js';
import type { MediaRetentionDays } from './media.js';

/** Layered consent (product plan §4.7). Absent/false scope = not granted — fail-safe default. */
export type ConsentFlags = Partial<Record<ConsentScope, boolean>>;

export interface Family {
  id: string;
  locale: string;
  low_bandwidth_mode: boolean;
  consent_flags: ConsentFlags;
  /** Parent-facing media retention window (issue #142, product plan §5 item 13) — defaults
   * to 90 days; changing it is retroactive (see MediaRetentionDays' own doc comment). */
  media_retention_days: MediaRetentionDays;
}

/**
 * Optional, inclusively-worded gender field (issue #25). Captured to help narrow down
 * interpretation later; USING it anywhere (scoring, phrasing, presentation-difference
 * handling) is clinical content that needs advisor sign-off first (CLAUDE.md §9) — today
 * it is stored and echoed back, nothing more.
 */
export const GENDER_OPTIONS = [
  'girl',
  'boy',
  'self_describe',
  'prefer_not_to_say',
] as const;
export type GenderOption = (typeof GENDER_OPTIONS)[number];

export interface Child {
  id: string;
  family_id: string;
  nickname: string;
  /** Month of birth, 1–12. Month+year only — deliberately never the full date (issue #25). */
  birth_month: number;
  /** Four-digit year of birth. */
  birth_year: number;
  /**
   * DERIVED from birth_month/birth_year at read time (see ageBand.ts) — never stored, so
   * it can't go stale as the child ages. Kept on the API surface for existing consumers.
   */
  age_band: AgeBand;
  /** Optional — absent when the caregiver skipped the question. */
  gender?: GenderOption;
  /** Caregiver's own words, only alongside gender === 'self_describe'. */
  gender_detail?: string;
  languages: string[];
}
