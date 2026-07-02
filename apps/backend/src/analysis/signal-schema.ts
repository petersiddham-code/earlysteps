/**
 * Defensive schema validation for LLM response-analysis output (CLAUDE.md §8:
 * "parse defensively and fail closed"). Anything that doesn't validate — non-JSON,
 * off-enum values, oversized arrays, injected extra prose — yields ZERO signals.
 * A malformed model response can therefore never influence anything downstream.
 */
import { z } from 'zod';
import {
  DOMAINS,
  RED_FLAG_TYPES,
  SIGNAL_SALIENCES,
  type FreeTextSignal,
} from '@earlysteps/shared-types';

const MAX_SIGNALS = 3;
const MAX_QUOTE_CHARS = 500;

const signalSchema = z.object({
  red_flag_type: z.enum(RED_FLAG_TYPES).nullable(),
  domain: z.enum(DOMAINS).nullable(),
  salience: z.enum(SIGNAL_SALIENCES),
  evidence_quote: z.string().max(MAX_QUOTE_CHARS),
});

const analysisOutputSchema = z.object({
  signals: z.array(signalSchema).max(MAX_SIGNALS),
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

/** Returns validated signals, or [] for anything malformed. Never throws. */
export function parseAnalysisOutput(rawOutput: string): FreeTextSignal[] {
  const json = extractJsonObject(rawOutput);
  if (json === null) return [];
  const parsed = analysisOutputSchema.safeParse(json);
  if (!parsed.success) return [];
  return parsed.data.signals;
}
