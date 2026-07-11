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

/**
 * The minimum-evidence "not enough information yet" state (issue #22): rendered INSTEAD of a
 * sign level, support-level term, or recommendation tier when fewer questions were answered
 * than the evidence floors in `@earlysteps/content` allow (gate lives in
 * `@earlysteps/scoring-engine`). Red flags are EXEMPT from the gate and always surface
 * (CLAUDE.md §2 rule 8).
 *
 * PLACEHOLDER COPY pending clinical sign-off — this is a NEW result-state string beyond the
 * fixed approved list in CLAUDE.md §2 rule 2, recorded in
 * docs/clinical-review/2026-07-02-minimum-evidence-gate.md. Do not reword without that
 * sign-off.
 */
export const INSUFFICIENT_EVIDENCE_LABEL = 'Not enough information yet';
export type InsufficientEvidenceLabel = typeof INSUFFICIENT_EVIDENCE_LABEL;

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

const BANNED_WORD_PATTERN = new RegExp(`\\b(${BANNED_WORDS.join('|')})\\b`, 'i');

/**
 * Reserved strings that must only ever come from the deterministic scoring engine (CLAUDE.md
 * §2 rule 7) — a freely-generated LLM narrative (issue #104's independent AI results
 * summary) must never use any of these, since doing so would read as a second, competing
 * verdict about the child rather than the engine's own official finding.
 */
const RESERVED_RESULT_PHRASES: readonly string[] = [
  ...SIGN_LEVEL_LABELS,
  ...RECOMMENDATION_TIERS,
  ...SUPPORT_LEVEL_TERMS,
];

/**
 * Runtime, fail-closed content-safety check for LLM-generated caregiver-facing text
 * (CLAUDE.md §8: "parse defensively and fail closed"). Mirrors the banned-word rule
 * scripts/lint-content.mjs enforces on static content, applied instead to ephemeral
 * generated narrative text the lint script never sees. Deliberately stricter than the
 * static-content check — no allowlisted phrases — since generated text can't be
 * human-audited the way shipped content JSON is.
 */
export function containsUnsafeResultLanguage(text: string): boolean {
  if (BANNED_WORD_PATTERN.test(text)) return true;
  const lower = text.toLowerCase();
  return RESERVED_RESULT_PHRASES.some((phrase) => lower.includes(phrase.toLowerCase()));
}

/**
 * Option ids that mean "the caregiver doesn't know / prefers not to say" rather than an
 * observation about the child. Product plan §4.1b: "I'm not sure is always an option, never
 * a trap" — so these answers are NO evidence in either direction. The scoring engine treats
 * them as unanswered (they must not pull a domain score down like a reassuring answer, and
 * must not raise confidence/completeness), and content validation rejects any weight
 * assigned to them. Changing this list is clinical content (CLAUDE.md §9).
 */
export const UNCERTAINTY_OPTION_IDS = ['not_sure', 'prefer_not_to_say'] as const;
export type UncertaintyOptionId = (typeof UNCERTAINTY_OPTION_IDS)[number];

/**
 * Layered consent scopes (product plan §4.7, CLAUDE.md §6 `<ConsentToggle />`). Each is
 * togglable independently — never bundled into a single "I agree" checkbox.
 */
export const CONSENT_SCOPES = [
  'data_storage',
  'ai_analysis',
  'media_capture',
  'professional_sharing',
] as const;
export type ConsentScope = (typeof CONSENT_SCOPES)[number];
