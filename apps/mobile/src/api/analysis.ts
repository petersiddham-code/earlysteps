import type {
  AiResultsSummary,
  ComparisonResult,
  FollowUpAnswer,
  FollowUpSuggestion,
  ResultsView,
} from '@earlysteps/shared-types';
import { apiClient } from './client.js';
import { isGuestChildId } from '../guest/guestStore.js';

/**
 * Free-text response-analysis endpoints (issue #26). All best-effort extras on top of
 * the deterministic results: callers must treat any failure (including the 403 that
 * means ai_analysis consent is off) as "no follow-ups", never as a results error.
 */

/** Analyzes any new typed answers server-side and returns all pending follow-ups. */
export function analyzeResponses(childId: string): Promise<FollowUpSuggestion[]> {
  // Guest/ephemeral child (issue #63): free-text analysis is an LLM call keyed by a
  // server-side child record, which a guest session deliberately never creates — no
  // follow-ups, same as ai_analysis consent being off. The deterministic results this
  // sits on top of are complete without it.
  if (isGuestChildId(childId)) return Promise.resolve([]);
  return apiClient.post<FollowUpSuggestion[]>(`/children/${childId}/response-analysis`);
}

export function getFollowUpSuggestions(childId: string): Promise<FollowUpSuggestion[]> {
  return apiClient.get<FollowUpSuggestion[]>(
    `/children/${childId}/follow-up-suggestions`,
  );
}

/**
 * Submits the caregiver's structured answer — it becomes a normal intake response in
 * the deterministic pipeline — and returns the freshly recomputed results view.
 */
export function answerFollowUpSuggestion(
  childId: string,
  suggestionId: string,
  answer: FollowUpAnswer,
): Promise<ResultsView> {
  return apiClient.post<ResultsView>(
    `/children/${childId}/follow-up-suggestions/${suggestionId}/answer`,
    { answer },
  );
}

/**
 * Independent AI results summary (issue #104): called once when Results loads, not when
 * the collapsible section is expanded, so the narrative is ready (or in flight) by the
 * time the caregiver opens it. Null means "no section" — offline, no AI consent (403),
 * no API key, or a malformed/unsafe model response all collapse to the same no-op.
 */
export function getAiResultsSummary(childId: string): Promise<AiResultsSummary | null> {
  // Guest/ephemeral child (issue #63): same reasoning as analyzeResponses above — no
  // server-side child record to key the cached narrative on.
  if (isGuestChildId(childId)) return Promise.resolve(null);
  return apiClient.post<AiResultsSummary | null>(`/children/${childId}/results-summary`);
}

/**
 * The Comparison Section (CLAUDE.md §13/§14, dual-assessment update): agreement / partial
 * agreement / disagreement between Assessment A and Assessment B, computed AFTER both have
 * independently produced their own output. Same fail-closed contract as
 * `getAiResultsSummary` — null means "no section", never a visible error.
 */
export function getComparisonResult(childId: string): Promise<ComparisonResult | null> {
  // Guest/ephemeral child (issue #63): same reasoning as getAiResultsSummary above.
  if (isGuestChildId(childId)) return Promise.resolve(null);
  return apiClient.post<ComparisonResult | null>(`/children/${childId}/comparison`);
}
