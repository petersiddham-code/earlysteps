/**
 * Defensive schema + content-safety validation for the LLM results-summary output —
 * Assessment B (CLAUDE.md §8: "parse defensively and fail closed"). v2 (2026-07-11
 * dual-assessment update): validates the full CLAUDE.md §13 schema (likelihood, confidence,
 * reasoning, developmental profile, strengths, tiered support priorities, uncertainty +
 * structured uncertainty factors, evidence summary, home/school recommendations,
 * professional-assessment priorities) — replacing v1's overview/areas_to_watch/
 * noted_by_caregiver shape.
 *
 * Anything that doesn't validate — non-JSON, oversized fields, an out-of-enum value, or a
 * banned word/reserved result label anywhere in the text — yields null. A malformed or
 * unsafe model response can therefore never reach a caregiver's screen; the section just
 * doesn't render.
 *
 * Professional-referral carve-out (flagged for clinical-review sign-off, see
 * docs/clinical-review/2026-07-11-dual-assessment-architecture.md): every field is checked
 * against BOTH halves of the content-safety check EXCEPT `professional_assessment_priorities`,
 * whose entire stated purpose (CLAUDE.md §13) is naming professional-assessment priorities —
 * it is checked only against `containsBannedOrReservedLanguage`, never against the
 * professional-referral-term ban, so it still can't reuse the deterministic engine's own
 * tier wording.
 */
import { z } from 'zod';
import {
  AI_LIKELIHOOD_LABELS,
  CONFIDENCE_LEVELS,
  UNCERTAINTY_FACTORS,
  containsBannedOrReservedLanguage,
  containsProfessionalReferralLanguage,
  type AiResultsSummary,
} from '@earlysteps/shared-types';

// 800 was too tight for real generations (live-verified 2026-07-11: a genuinely synthesized
// evidence_summary/reasoning routinely lands in the 700-850 char range once free-text
// caregiver notes are involved, landing this cap right on the boundary — a real, frequent
// zod rejection with nothing to do with content safety). 1500 gives real headroom while
// still bounding a genuinely malformed/runaway response.
const MAX_LONG_TEXT = 1500;
const MAX_ITEM_CHARS = 300;
const MAX_ITEMS = 8;
const MAX_PRIORITY_ITEMS = 6;

const priorityItemSchema = z.object({
  priority: z.string().min(1).max(MAX_ITEM_CHARS),
  reason: z.string().min(1).max(MAX_ITEM_CHARS),
});

const supportPrioritiesSchema = z.object({
  immediate: z.array(priorityItemSchema).max(MAX_PRIORITY_ITEMS),
  short_term: z.array(priorityItemSchema).max(MAX_PRIORITY_ITEMS),
  medium_term: z.array(priorityItemSchema).max(MAX_PRIORITY_ITEMS),
  long_term: z.array(priorityItemSchema).max(MAX_PRIORITY_ITEMS),
});

const summaryOutputSchema = z.object({
  likelihood: z.enum(AI_LIKELIHOOD_LABELS),
  confidence: z.enum(CONFIDENCE_LEVELS),
  reasoning: z.string().min(1).max(MAX_LONG_TEXT),
  developmental_profile: z.string().min(1).max(MAX_LONG_TEXT),
  strengths: z.array(z.string().min(1).max(MAX_ITEM_CHARS)).max(MAX_ITEMS),
  support_priorities: supportPrioritiesSchema,
  uncertainty: z.string().min(1).max(MAX_LONG_TEXT),
  uncertainty_factors: z
    .array(z.enum(UNCERTAINTY_FACTORS))
    .max(UNCERTAINTY_FACTORS.length),
  evidence_summary: z.string().min(1).max(MAX_LONG_TEXT),
  home_recommendations: z.array(z.string().min(1).max(MAX_ITEM_CHARS)).max(MAX_ITEMS),
  school_recommendations: z.array(z.string().min(1).max(MAX_ITEM_CHARS)).max(MAX_ITEMS),
  professional_assessment_priorities: z
    .array(z.string().min(1).max(MAX_ITEM_CHARS))
    .max(MAX_ITEMS),
});

type SummaryOutput = z.infer<typeof summaryOutputSchema>;

/**
 * Extracts the first top-level JSON object from the model's text output. The prompt
 * demands bare JSON, but the parser must not trust that (fenced code blocks, stray
 * prose around the object, ...).
 */
function extractJsonObject(text: string): unknown | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function flattenPriorities(priorities: SummaryOutput['support_priorities']): string[] {
  return [
    ...priorities.immediate,
    ...priorities.short_term,
    ...priorities.medium_term,
    ...priorities.long_term,
  ].flatMap((item) => [item.priority, item.reason]);
}

/**
 * Every free-text field EXCEPT `professional_assessment_priorities` (see the carve-out
 * note above). `likelihood`/`confidence` are excluded here too — they're validated by
 * `z.enum` above and can't carry unsafe text by construction.
 */
function generalStrings(s: SummaryOutput): string[] {
  return [
    s.reasoning,
    s.developmental_profile,
    ...s.strengths,
    ...flattenPriorities(s.support_priorities),
    s.uncertainty,
    s.evidence_summary,
    ...s.home_recommendations,
    ...s.school_recommendations,
  ];
}

function isUnsafe(s: SummaryOutput): boolean {
  if (
    generalStrings(s).some(
      (text) =>
        containsBannedOrReservedLanguage(text) ||
        containsProfessionalReferralLanguage(text),
    )
  ) {
    return true;
  }
  return s.professional_assessment_priorities.some(containsBannedOrReservedLanguage);
}

function toAiResultsSummary(s: SummaryOutput): AiResultsSummary {
  return {
    likelihood: s.likelihood,
    confidence: s.confidence,
    reasoning: s.reasoning,
    developmentalProfile: s.developmental_profile,
    strengths: s.strengths,
    supportPriorities: {
      immediate: s.support_priorities.immediate,
      short_term: s.support_priorities.short_term,
      medium_term: s.support_priorities.medium_term,
      long_term: s.support_priorities.long_term,
    },
    uncertainty: s.uncertainty,
    uncertaintyFactors: s.uncertainty_factors,
    evidenceSummary: s.evidence_summary,
    homeRecommendations: s.home_recommendations,
    schoolRecommendations: s.school_recommendations,
    professionalAssessmentPriorities: s.professional_assessment_priorities,
    generatedAt: new Date().toISOString(),
  };
}

function toSummaryOutput(summary: AiResultsSummary): SummaryOutput {
  return {
    likelihood: summary.likelihood,
    confidence: summary.confidence,
    reasoning: summary.reasoning,
    developmental_profile: summary.developmentalProfile,
    strengths: summary.strengths,
    support_priorities: {
      immediate: summary.supportPriorities.immediate,
      short_term: summary.supportPriorities.short_term,
      medium_term: summary.supportPriorities.medium_term,
      long_term: summary.supportPriorities.long_term,
    },
    uncertainty: summary.uncertainty,
    uncertainty_factors: summary.uncertaintyFactors,
    evidence_summary: summary.evidenceSummary,
    home_recommendations: summary.homeRecommendations,
    school_recommendations: summary.schoolRecommendations,
    professional_assessment_priorities: summary.professionalAssessmentPriorities,
  };
}

/**
 * Re-checks an already-parsed, previously cached narrative against the current
 * content-safety rules (issue #104 QA precedent, PR #105): the safety check itself can
 * gain new rules over time, so a narrative cached under an older, weaker check must never
 * keep serving unsafe content indefinitely just because the caregiver's answers haven't
 * changed since it was generated. The caller treats `false` as a cache miss and regenerates.
 *
 * Live-verified 2026-07-12: a row cached under the pre-v2 shape (`overview`/`areasToWatch`/
 * `notedByCaregiver`, no `supportPriorities`) crashed this with an uncaught TypeError instead
 * of failing closed — `PrismaAnalysisRepository.getCachedAiSummary` trusts the DB's JSON blob
 * shape without validating it, so any legacy or otherwise malformed cached row reached here
 * unchecked. Wrapped in try/catch so a shape mismatch is treated the same as "unsafe" (cache
 * miss, regenerate fresh) rather than a 500 — consistent with this whole module's fail-closed
 * design (CLAUDE.md §8), just extended to cover a corrupt/outdated CACHE read, not only a
 * fresh LLM response.
 */
export function isSummaryStillSafe(summary: AiResultsSummary): boolean {
  try {
    return !isUnsafe(toSummaryOutput(summary));
  } catch {
    return false;
  }
}

/**
 * Returns the validated narrative, or null for anything malformed OR carrying a banned
 * word/reserved result label — the whole narrative is discarded on any single violation
 * (not just the offending field), since a partial narrative wasn't reviewed as a whole.
 * `generatedAt` is stamped by the caller, not the model. Never throws.
 */
export function parseAiSummaryOutput(rawOutput: string): AiResultsSummary | null {
  const json = extractJsonObject(rawOutput);
  if (json === null) return null;
  const parsed = summaryOutputSchema.safeParse(json);
  if (!parsed.success) return null;
  if (isUnsafe(parsed.data)) return null;
  return toAiResultsSummary(parsed.data);
}
