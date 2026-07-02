/**
 * Zod schemas for content files. Used by both validateContent() and the lint:content
 * safety gate, so a malformed or unsafe content file fails fast in CI rather than reaching
 * a caregiver (CLAUDE.md §5, §8, §10).
 */
import { z } from 'zod';
import {
  AGE_BANDS,
  BANNED_WORDS,
  CONSENT_SCOPES,
  DOMAINS,
  QUESTION_TYPES,
  RED_FLAG_TYPES,
  SIGN_LEVELS,
  SUPPORT_LEVELS,
} from '@earlysteps/shared-types';

const bannedWordPattern = new RegExp(`\\b(${BANNED_WORDS.join('|')})\\b`, 'i');

/**
 * Explicit, reviewed exceptions: benign phrases that contain a listed word but do not
 * pathologise the child (the rule targets words applied TO the child). Keep in sync with
 * scripts/lint-content.mjs ALLOWLISTED_PHRASES. New/unlisted occurrences still fail.
 */
const ALLOWLISTED_PHRASES = [
  "there's no wrong answer",
  'no wrong answer',
  // Product plan §4.8's mandated red-flag escalation text, verbatim — a reassuring negation
  // ("nothing is wrong"), not a defect-label applied to the child.
  'seriously wrong',
];

const notBanned = (s: string) => {
  if (!bannedWordPattern.test(s)) return true;
  const lower = s.toLowerCase();
  return ALLOWLISTED_PHRASES.some((phrase) => lower.includes(phrase));
};
const bannedMessage = (s: string) => ({
  message: `contains a banned word: ${JSON.stringify(s.match(bannedWordPattern)?.[0])}`,
});

/** A user-facing string that must not contain a banned word (CLAUDE.md §2 rule 4). */
export const safeCopy = z.string().refine(notBanned, bannedMessage);

/** Same, but must also be non-empty (used for required fields like `hint`). */
export const safeCopyNonEmpty = z.string().min(1).refine(notBanned, bannedMessage);

const questionDomain = z.enum([...DOMAINS, 'profile', 'strengths']);
// Derived from the shared-types source of truth so a new band can't silently drift.
const questionAgeBand = z.enum([...AGE_BANDS, 'universal']);

export const optionSchema = z.object({
  id: z.string().min(1),
  label: safeCopy,
});

export const questionSchema = z.object({
  id: z.string().min(1),
  domain: questionDomain,
  age_band: questionAgeBand,
  text: safeCopy,
  type: z.enum(QUESTION_TYPES),
  options: z.array(optionSchema),
  // Every question needs a non-empty, safe hint (CLAUDE.md §5).
  hint: safeCopyNonEmpty,
  allow_free_text: z.boolean().optional(),
  follow_up: z.string().optional(),
  // Answer is captured elsewhere (e.g. Child Profile Setup) — the questionnaire flow
  // deliberately skips these instead of asking the caregiver twice (#24).
  collected_at: z.enum(['profile_setup']).optional(),
});

export const questionBankSchema = z.object({
  version: z.string(),
  locale: z.string(),
  age_band: questionAgeBand,
  questions: z.array(questionSchema).min(1),
});

const indicatorSchema = z.object({
  question_id: z.string().min(1),
  domain: z.enum(DOMAINS),
  combine: z.enum(['max', 'sum']),
  option_weights: z.record(z.string(), z.number().nonnegative()),
});

export const weightsTableSchema = z.object({
  version: z.string(),
  needs_clinical_signoff: z.boolean(),
  note: z.string(),
  indicators: z.array(indicatorSchema).min(1),
});

/**
 * Confirmation follow-ups for LLM-detected free-text signals (issue #26). Each maps one
 * red-flag type to a caregiver-facing yes/no/not-sure question whose id (`FU_<type>`) the
 * deterministic red-flag rules read directly — the AI never fires a flag itself.
 */
export const followUpSchema = z.object({
  id: z.string().min(1),
  red_flag_type: z.enum(RED_FLAG_TYPES),
  text: safeCopyNonEmpty,
  // Same rule as questions (CLAUDE.md §5): never ship without a reassuring hint.
  hint: safeCopyNonEmpty,
  options: z.array(optionSchema).min(1),
});

export const followUpsFileSchema = z.object({
  version: z.string(),
  locale: z.string(),
  needs_clinical_signoff: z.boolean(),
  note: z.string(),
  follow_ups: z.array(followUpSchema).min(1),
});

export const resultCopySchema = z.object({
  version: z.string(),
  locale: z.string(),
  needs_clinical_signoff: z.boolean(),
  note: z.string(),
  disclaimer: safeCopy,
  sign_level_labels: z.record(z.enum(SIGN_LEVELS), z.string()),
  recommendation_tiers: z.record(z.string(), z.string()),
  support_level_terms: z.record(z.enum(SUPPORT_LEVELS), z.string()),
  /**
   * The "not enough information yet" state (issue #22 minimum-evidence gate). `label` must
   * exactly match INSUFFICIENT_EVIDENCE_LABEL (enforced by validateContent()); the detail
   * sentences are the caregiver-facing explanation on the Results screen.
   */
  insufficient_evidence: z.object({
    label: safeCopyNonEmpty,
    domain_detail: safeCopyNonEmpty,
    overall_detail: safeCopyNonEmpty,
  }),
});

/**
 * Minimum-evidence floors (issue #22): below these counts of answered scored questions the
 * engine emits "not enough information yet" instead of a level/estimate/tier. Clinical
 * content — placeholder values until advisor sign-off (needs_clinical_signoff).
 */
export const evidenceFloorsSchema = z.object({
  version: z.string(),
  needs_clinical_signoff: z.boolean(),
  note: z.string(),
  min_scored_answers_per_domain: z.number().int().positive(),
  min_scored_answers_overall: z.number().int().positive(),
});

/** Red-flag escalation copy (product plan §4.8): calm, non-alarmist, never diagnostic. */
export const redFlagCopySchema = z.object({
  version: z.string(),
  locale: z.string(),
  needs_clinical_signoff: z.boolean(),
  note: z.string(),
  base_message: safeCopyNonEmpty,
  next_steps_heading: safeCopyNonEmpty,
  urgent_resource_heading: safeCopyNonEmpty,
  urgent_resource_message: safeCopyNonEmpty,
});

const consentScopeCopySchema = z.object({
  label: safeCopyNonEmpty,
  explanation: safeCopyNonEmpty,
});

/**
 * Layered consent copy (product plan §4.7): a 1-line plain explanation per scope. Built as an
 * explicit object (one required key per scope), not z.record — a record's value type is
 * optional-indexed under TS access, which would force every caller to null-check copy that's
 * actually guaranteed complete (enforced by validateContent()).
 */
export const consentCopySchema = z.object({
  version: z.string(),
  locale: z.string(),
  scopes: z.object(
    Object.fromEntries(
      CONSENT_SCOPES.map((scope) => [scope, consentScopeCopySchema]),
    ) as Record<(typeof CONSENT_SCOPES)[number], typeof consentScopeCopySchema>,
  ),
});

export type FollowUp = z.infer<typeof followUpSchema>;
export type FollowUpsFile = z.infer<typeof followUpsFileSchema>;
export type WeightsTable = z.infer<typeof weightsTableSchema>;
export type Indicator = z.infer<typeof indicatorSchema>;
export type ResultCopy = z.infer<typeof resultCopySchema>;
export type EvidenceFloors = z.infer<typeof evidenceFloorsSchema>;
export type RedFlagCopy = z.infer<typeof redFlagCopySchema>;
export type ConsentCopy = z.infer<typeof consentCopySchema>;
