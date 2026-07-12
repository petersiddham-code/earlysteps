/**
 * Port for the independent AI results-summary call (issue #104).
 *
 * The client receives only the raw questionnaire answers plus age band/gender — never the
 * deterministic engine's computed levels, estimate, recommendation, or red flags (CLAUDE.md
 * §2 rule 7). All interpretation happens in AnalysisService behind schema + content-safety
 * validation — the client cannot influence scoring in any way.
 */

/** One answered question, reduced to what the narrative prompt needs (PII minimization). */
export interface AiSummaryAnsweredQuestion {
  questionText: string;
  /** Caregiver-facing option label(s) selected, already resolved from ids. */
  selectedLabels: string[];
  /** The caregiver's own typed note, if any (free_text: prefix already stripped). */
  freeText?: string;
}

export interface AiResultsSummaryInput {
  ageBand: string;
  gender?: string;
  answers: AiSummaryAnsweredQuestion[];
}

export interface AiResultsSummaryClient {
  /**
   * Returns the model's raw text output, or null when generation is unavailable (no API
   * key configured, transport failure, ...). The stage always fails closed: whatever this
   * returns is schema- and content-safety-validated before anything is done with it.
   */
  generateSummary(input: AiResultsSummaryInput): Promise<string | null>;
}

export const AI_RESULTS_SUMMARY_CLIENT = Symbol('AI_RESULTS_SUMMARY_CLIENT');

/**
 * Wired when no ANTHROPIC_API_KEY is configured: the section silently never renders and
 * the deterministic Results screen is unaffected (offline-first, same as issue #26).
 */
export class DisabledAiResultsSummaryClient implements AiResultsSummaryClient {
  async generateSummary(): Promise<null> {
    return null;
  }
}
