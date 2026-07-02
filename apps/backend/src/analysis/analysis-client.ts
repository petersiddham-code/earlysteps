/**
 * Port for the LLM response-analysis call (issue #26).
 *
 * The client only ever receives the question text and ONE caregiver free-text answer
 * (PII minimization, CLAUDE.md §8) and only ever returns the model's raw text output.
 * All interpretation happens in AnalysisService behind schema validation — the client
 * cannot influence scoring in any way (CLAUDE.md §2 rule 7).
 */

export interface FreeTextAnalysisInput {
  /** The question the caregiver was answering (raw content text, [child] unreplaced). */
  questionText: string;
  /** The caregiver's typed answer, verbatim (free_text: prefix already stripped). */
  freeText: string;
}

export interface ResponseAnalysisClient {
  /**
   * Returns the model's raw text output, or null when analysis is unavailable
   * (no API key configured, transport failure, ...). Null means "not analyzed yet" —
   * the response stays eligible for a later retry. The stage always fails closed:
   * whatever this returns is schema-validated before anything is done with it.
   */
  analyzeFreeText(input: FreeTextAnalysisInput): Promise<string | null>;
}

export const RESPONSE_ANALYSIS_CLIENT = Symbol('RESPONSE_ANALYSIS_CLIENT');

/**
 * Wired when no ANTHROPIC_API_KEY is configured: the stage silently contributes
 * nothing and the deterministic pipeline is unaffected (offline-first, issue #26).
 */
export class DisabledResponseAnalysisClient implements ResponseAnalysisClient {
  async analyzeFreeText(): Promise<null> {
    return null;
  }
}
