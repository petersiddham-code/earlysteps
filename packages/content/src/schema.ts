/**
 * Zod schemas for content files. Used by both validateContent() and the lint:content
 * safety gate, so a malformed or unsafe content file fails fast in CI rather than reaching
 * a caregiver (CLAUDE.md §5, §8, §10).
 */
import { z } from 'zod';
import {
  BANNED_WORDS,
  DOMAINS,
  QUESTION_TYPES,
  SIGN_LEVELS,
  SUPPORT_LEVELS,
} from '@earlysteps/shared-types';

const bannedWordPattern = new RegExp(`\\b(${BANNED_WORDS.join('|')})\\b`, 'i');

/**
 * Explicit, reviewed exceptions: benign phrases that contain a listed word but do not
 * pathologise the child (the rule targets words applied TO the child). Keep in sync with
 * scripts/lint-content.mjs ALLOWLISTED_PHRASES. New/unlisted occurrences still fail.
 */
const ALLOWLISTED_PHRASES = ["there's no wrong answer", 'no wrong answer'];

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
const questionAgeBand = z.enum(['toddler', 'preschool', 'primary', 'teen', 'universal']);

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

export const resultCopySchema = z.object({
  version: z.string(),
  locale: z.string(),
  needs_clinical_signoff: z.boolean(),
  note: z.string(),
  disclaimer: safeCopy,
  sign_level_labels: z.record(z.enum(SIGN_LEVELS), z.string()),
  recommendation_tiers: z.record(z.string(), z.string()),
  support_level_terms: z.record(z.enum(SUPPORT_LEVELS), z.string()),
});

export type WeightsTable = z.infer<typeof weightsTableSchema>;
export type Indicator = z.infer<typeof indicatorSchema>;
export type ResultCopy = z.infer<typeof resultCopySchema>;
