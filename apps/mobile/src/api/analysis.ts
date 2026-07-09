import type {
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
