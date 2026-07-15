/**
 * Admin Console read models (issue #125). All three are read-only in this phase — no
 * write endpoint accepts these shapes back. None of them carry question answers, scores,
 * reports, free text, or media (CLAUDE.md §2 rule 10's PII-minimization principle,
 * applied to admin-facing views, not just analytics).
 */
import type { UserRole, UserTier } from './auth.js';

export interface AdminAccountSummary {
  id: string;
  username: string;
  tier: UserTier;
  role: UserRole;
  created_at: string;
  family_count: number;
  child_count: number;
}

export interface AdminQuestionBankSummary {
  age_band: string;
  locale: string;
  version: string;
  question_count: number;
}

export interface AdminContentSummary {
  question_banks: AdminQuestionBankSummary[];
  red_flag_copy_version: string;
  red_flag_copy_needs_signoff: boolean;
}

export interface AdminClinicalReviewLogEntry {
  date: string;
  content_version: string;
  what_changed: string;
  advisor: string;
  status: string;
}

/**
 * Content editing (issue #127). Editing is draft-only — see
 * docs/clinical-review/2026-07-15-issue127-admin-content-editing-plan.md. A draft never
 * writes packages/content at runtime; going live still requires a normal PR + CI +
 * docs/clinical-review sign-off, same as a hand-edit of the JSON today (CLAUDE.md §9). The
 * registry of which content keys/fields are draftable at all lives server-side in
 * apps/backend/src/admin/admin-content-registry.ts — scoring weights, evidence-floor
 * thresholds, and structural/id fields (option ids, red-flag types, age bands, the fixed
 * result-label vocabulary, the verbatim disclaimer) are never in it, so this shape can never
 * describe an edit to any of those regardless of what a client sends.
 */
export const ADMIN_EDITABLE_CONTENT_KEYS = [
  'questions.universal',
  'questions.toddler',
  'questions.preschool',
  'questions.primary',
  'questions.teen',
  'questions.young_adult',
  'result-copy.labels',
  'result-copy.red-flag-copy',
  'domain-resources',
  'follow-ups',
  'consent.copy',
  'ai-results-summary.copy',
  'comparison.copy',
] as const;
export type AdminEditableContentKey = (typeof ADMIN_EDITABLE_CONTENT_KEYS)[number];

/** One draftable leaf field within a content key, with its current live value. */
export interface AdminEditableField {
  /** Dotted/bracketed address, e.g. "card_heading" or "Q1.hint" or "scopes.data_storage.label". */
  path: string;
  /** Human-readable label built from the path, e.g. "Q1 — hint". */
  label: string;
  current_value: string;
}

export interface AdminContentDetail {
  content_key: AdminEditableContentKey;
  fields: AdminEditableField[];
}

export interface AdminContentDraft {
  id: string;
  content_key: string;
  field_path: string;
  current_value: string;
  proposed_value: string;
  note: string;
  created_by: string;
  created_at: string;
  status: 'pending' | 'discarded';
}

export interface AdminContentDraftInput {
  field_path: string;
  proposed_value: string;
  note: string;
}
