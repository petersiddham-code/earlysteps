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

/**
 * Assessment B's (the AI Assessment Engine, CLAUDE.md §13) likelihood scale — a SEPARATE
 * scale from Assessment A's SIGN_LEVEL_LABELS above (CLAUDE.md §2 rule 2). Never substitute
 * one vocabulary for the other, and keep them visually distinct on screen (rule 14).
 */
export const AI_LIKELIHOOD_LEVELS = [
  'very_low',
  'low',
  'moderate',
  'high',
  'very_high',
] as const;
export type AiLikelihoodLevel = (typeof AI_LIKELIHOOD_LEVELS)[number];

export const AI_LIKELIHOOD_LABELS = [
  'Very Low',
  'Low',
  'Moderate',
  'High',
  'Very High',
] as const;
export type AiLikelihoodLabel = (typeof AI_LIKELIHOOD_LABELS)[number];

export const AI_LIKELIHOOD_TO_LABEL: Record<AiLikelihoodLevel, AiLikelihoodLabel> = {
  very_low: 'Very Low',
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
  very_high: 'Very High',
};

/**
 * Assessment B's self-reported evidence-uncertainty taxonomy (CLAUDE.md §13's "uncertainty"
 * field). Describes uncertainty ONLY in the evidence Assessment B itself was given — it must
 * never reference or imply anything about Assessment A's output (isolation, rule 7 §2).
 */
export const UNCERTAINTY_FACTORS = [
  'contradictory_responses',
  'conflicting_developmental_history',
  'limited_free_text_evidence',
  'sparse_structured_answers',
] as const;
export type UncertaintyFactor = (typeof UNCERTAINTY_FACTORS)[number];

export const UNCERTAINTY_FACTOR_LABELS: Record<UncertaintyFactor, string> = {
  contradictory_responses: 'Contradictory responses',
  conflicting_developmental_history: 'Conflicting developmental history',
  limited_free_text_evidence: 'Limited free-text evidence',
  sparse_structured_answers: 'Sparse structured answers',
};

/**
 * Which evidence sources actually fed a given Assessment B narrative (CLAUDE.md §13/§16
 * migration status: "a schema addition to AiResultsSummary's evidence summary noting which
 * modalities contributed"). Computed deterministically by the caller from what was actually
 * sent to the model — never self-reported by the LLM, so it can't drift from the truth.
 * `photo` is the only media modality wired up so far (issue #135, Phase 2 of the issue #133
 * plan); video/audio are tracked as follow-up work, not silently folded into this value.
 */
export const EVIDENCE_MODALITIES = ['structured_answers', 'free_text', 'photo'] as const;
export type EvidenceModality = (typeof EVIDENCE_MODALITIES)[number];

/**
 * Comparison Section vocabulary (CLAUDE.md §13/rule 14 §2) — computed by
 * @earlysteps/comparison-engine AFTER both engines have independently produced their own
 * output; never merged, averaged, or reconciled into one number or label.
 */
export const COMPARISON_STATUSES = [
  'agreement',
  'partial_agreement',
  'disagreement',
] as const;
export type ComparisonStatus = (typeof COMPARISON_STATUSES)[number];

export const COMPARISON_STATUS_LABELS: Record<ComparisonStatus, string> = {
  agreement: 'Agreement',
  partial_agreement: 'Partial agreement',
  disagreement: 'Disagreement',
};

/** The six disagreement reasons named verbatim in CLAUDE.md §13. */
export const COMPARISON_REASONS = [
  'unsupported_text_evidence',
  'contradictory_responses',
  'insufficient_evidence',
  'missing_observations',
  'low_confidence',
  'conflicting_developmental_history',
] as const;
export type ComparisonReason = (typeof COMPARISON_REASONS)[number];

export const COMPARISON_REASON_LABELS: Record<ComparisonReason, string> = {
  unsupported_text_evidence: 'Unsupported text evidence',
  contradictory_responses: 'Contradictory responses',
  insufficient_evidence: 'Insufficient evidence',
  missing_observations: 'Missing observations',
  low_confidence: 'Low confidence',
  conflicting_developmental_history: 'Conflicting developmental history',
};

/**
 * Coarse 3-band risk position both engines' own vocabularies collapse onto SOLELY for
 * comparison purposes — never rendered as a label itself; each engine keeps rendering only
 * its own vocabulary on screen (rule 2 §2).
 */
export const RISK_BANDS = ['low', 'medium', 'high'] as const;
export type RiskBand = (typeof RISK_BANDS)[number];

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
 * Terms naming a professional or a referral to one — banned from the independent AI
 * results summary regardless of phrasing (issue #104 QA: a model can suggest "worth
 * discussing with a healthcare provider" or "a professional should hear about this"
 * without ever using a reserved label, and that reads as a second, competing
 * recommendation just as much as the reserved phrases do). Whether and when to see a
 * professional is exclusively the deterministic recommendation tier and red-flag rules'
 * call (CLAUDE.md §2 rules 7-8) — this narrative only ever describes the raw answers.
 */
const PROFESSIONAL_REFERRAL_TERMS = [
  'professional',
  'doctor',
  'pediatrician',
  'paediatrician',
  'specialist',
  'clinician',
  'healthcare provider',
  'health care provider',
] as const;
const PROFESSIONAL_REFERRAL_PATTERN = new RegExp(
  `\\b(${PROFESSIONAL_REFERRAL_TERMS.map((t) => t.replace(/ /g, '\\s+')).join('|')})\\b`,
  'i',
);

/**
 * Banned-word + reserved-result-phrase half of the content-safety check (CLAUDE.md §8:
 * "parse defensively and fail closed"). Split out from `containsUnsafeResultLanguage` (issue
 * #104 dual-assessment update) so a field whose entire stated purpose is naming professional
 * assessment priorities — Assessment B's `professionalAssessmentPriorities` (CLAUDE.md §13) —
 * can be exempted from the professional-referral half below without weakening this half.
 */
export function containsBannedOrReservedLanguage(text: string): boolean {
  if (BANNED_WORD_PATTERN.test(text)) return true;
  const lower = text.toLowerCase();
  return RESERVED_RESULT_PHRASES.some((phrase) => lower.includes(phrase.toLowerCase()));
}

/** Professional-referral half of the content-safety check — see PROFESSIONAL_REFERRAL_TERMS. */
export function containsProfessionalReferralLanguage(text: string): boolean {
  return PROFESSIONAL_REFERRAL_PATTERN.test(text);
}

/**
 * Runtime, fail-closed content-safety check for LLM-generated caregiver-facing text.
 * Mirrors the banned-word rule scripts/lint-content.mjs enforces on static content, applied
 * instead to ephemeral generated narrative text the lint script never sees. Deliberately
 * stricter than the static-content check — no allowlisted phrases — since generated text
 * can't be human-audited the way shipped content JSON is. Combines both halves above; most
 * fields should use this. `professionalAssessmentPriorities` is the one documented exception
 * (see `docs/clinical-review/2026-07-11-dual-assessment-architecture.md`) that uses only
 * `containsBannedOrReservedLanguage`.
 */
export function containsUnsafeResultLanguage(text: string): boolean {
  return (
    containsBannedOrReservedLanguage(text) || containsProfessionalReferralLanguage(text)
  );
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
