/**
 * The fixed, on-list safety vocabulary for EarlySteps.
 *
 * These are NOT style preferences — they encode CLAUDE.md §2 rules 2–4 and product plan
 * §3.2 at the type level. Because results copy, scoring output, and LLM post-processing all
 * consume these unions, an off-list label or support term is a *compile error*, not a
 * runtime surprise. Do not add, rename, or soften any member without a clinical-review
 * sign-off recorded under docs/clinical-review/.
 */

/** Per-domain finding, shown with a traffic-light bar — never a raw numeric score. */
export const SIGN_LEVEL_LABELS = [
  'Low signs observed',
  'Some signs observed',
  'Many signs observed',
] as const;
export type SignLevelLabel = (typeof SIGN_LEVEL_LABELS)[number];

/** Internal shorthand for a sign level; maps 1:1 to SIGN_LEVEL_LABELS. */
export const SIGN_LEVELS = ['low', 'some', 'many'] as const;
export type SignLevel = (typeof SIGN_LEVELS)[number];

export const SIGN_LEVEL_TO_LABEL: Record<SignLevel, SignLevelLabel> = {
  low: 'Low signs observed',
  some: 'Some signs observed',
  many: 'Many signs observed',
};

/** Recommendation tier shown to a caregiver. Verbatim per CLAUDE.md §2 rule 2. */
export const RECOMMENDATION_TIERS = [
  'Support activities can begin now',
  'Formal assessment is recommended',
  'Formal assessment strongly recommended soon',
] as const;
export type RecommendationTier = (typeof RECOMMENDATION_TIERS)[number];

/** Support-level terms. Always paired with a Confidence (CLAUDE.md §2 rule 3). */
export const SUPPORT_LEVEL_TERMS = [
  'mild support needs',
  'moderate support needs',
  'high support needs',
] as const;
export type SupportLevelTerm = (typeof SUPPORT_LEVEL_TERMS)[number];

/** Internal shorthand for a support level; maps 1:1 to SUPPORT_LEVEL_TERMS. */
export const SUPPORT_LEVELS = ['mild', 'moderate', 'high'] as const;
export type SupportLevel = (typeof SUPPORT_LEVELS)[number];

export const SUPPORT_LEVEL_TO_TERM: Record<SupportLevel, SupportLevelTerm> = {
  mild: 'mild support needs',
  moderate: 'moderate support needs',
  high: 'high support needs',
};

/** A screening tool is probabilistic — every finding carries a confidence. */
export const CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

/**
 * The exact disclaimer that must render on every results/report surface (CLAUDE.md §2
 * rule 5, product plan §3.2). Pulled verbatim — do not paraphrase.
 */
export const SCREENING_DISCLAIMER =
  'This is a screening tool, not a diagnosis. Only a qualified professional (paediatrician, psychologist, or developmental specialist) can diagnose autism.';

/**
 * Words banned from any user-facing string or content JSON (CLAUDE.md §2 rule 4).
 * The content-safety lint (scripts/lint-content.mjs) scans against this list.
 * "disorder" is banned as a label applied to the child; the lint flags any occurrence in
 * shipped copy so a human confirms the context.
 */
export const BANNED_WORDS = [
  'defect',
  'abnormal',
  'disorder',
  'broken',
  'wrong',
  'deficient',
  'disease',
  'sick',
  'cure',
  'fix',
] as const;
export type BannedWord = (typeof BANNED_WORDS)[number];

/** Approved replacement vocabulary, for reference by content authors and prompts. */
export const APPROVED_DIFFERENCE_TERMS = [
  'support needs',
  'developmental differences',
  'communication differences',
  'sensory needs',
  'learning style',
] as const;
