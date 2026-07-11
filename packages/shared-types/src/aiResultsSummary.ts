/**
 * Independent AI results summary (issue #104, product plan §9.3).
 *
 * Generated purely from the caregiver's raw questionnaire answers — the LLM never sees
 * the deterministic engine's computed levels, support estimate, recommendation, or red
 * flags (CLAUDE.md §2 rule 7: only the scoring engine ever decides those). This is a
 * second, independent read for the caregiver to compare against the official result, not
 * an explanation of it.
 */
export interface AiResultsSummary {
  /** 2-3 sentence plain-language overview of what the raw answers describe. */
  overview: string;
  strengths: string[];
  /** Respectful, non-alarmist phrasing — never one of the approved result labels/terms. */
  areasToWatch: string[];
  /** Plain-language reflection of anything the caregiver typed in a free-text box. */
  notedByCaregiver: string[];
  /** ISO 8601 timestamp of when this narrative was generated. */
  generatedAt: string;
}
