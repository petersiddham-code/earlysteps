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
