/**
 * Defensive schema + content-safety validation for the LLM results-summary output
 * (CLAUDE.md §8: "parse defensively and fail closed"). Anything that doesn't validate —
 * non-JSON, oversized fields, or a banned word/reserved result label anywhere in the
 * text — yields null. A malformed or unsafe model response can therefore never reach a
 * caregiver's screen; the section just doesn't render (issue #104).
 */
import { z } from 'zod';
import {
  containsUnsafeResultLanguage,
  type AiResultsSummary,
} from '@earlysteps/shared-types';

const MAX_OVERVIEW_CHARS = 800;
const MAX_ITEM_CHARS = 300;
const MAX_ITEMS = 8;

const summaryOutputSchema = z.object({
  overview: z.string().min(1).max(MAX_OVERVIEW_CHARS),
  strengths: z.array(z.string().min(1).max(MAX_ITEM_CHARS)).max(MAX_ITEMS),
  areas_to_watch: z.array(z.string().min(1).max(MAX_ITEM_CHARS)).max(MAX_ITEMS),
  noted_by_caregiver: z.array(z.string().min(1).max(MAX_ITEM_CHARS)).max(MAX_ITEMS),
});

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

function allStrings(parsed: z.infer<typeof summaryOutputSchema>): string[] {
  return [
    parsed.overview,
    ...parsed.strengths,
    ...parsed.areas_to_watch,
    ...parsed.noted_by_caregiver,
  ];
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
  if (allStrings(parsed.data).some(containsUnsafeResultLanguage)) return null;
  return {
    overview: parsed.data.overview,
    strengths: parsed.data.strengths,
    areasToWatch: parsed.data.areas_to_watch,
    notedByCaregiver: parsed.data.noted_by_caregiver,
    generatedAt: new Date().toISOString(),
  };
}
