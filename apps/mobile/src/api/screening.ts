import type { IntakeResponse, ResultsView } from '@earlysteps/shared-types';
import { apiClient } from './client.js';
import {
  getGuestIntakeResponses,
  getGuestResults,
  isGuestChildId,
  submitGuestIntakeResponses,
} from '../guest/guestStore.js';

/** The subset of IntakeResponse the backend DTO accepts — child_id is added server-side. */
export type IntakeResponseInput = Omit<IntakeResponse, 'child_id'>;

export function submitIntakeResponses(
  childId: string,
  responses: IntakeResponseInput[],
): Promise<ResultsView> {
  // Guest/ephemeral child (issue #63): scored on-device by the same deterministic engine,
  // never sent anywhere — this is precisely what declining "Save my answers" means.
  if (isGuestChildId(childId)) {
    return Promise.resolve().then(() =>
      submitGuestIntakeResponses(
        childId,
        responses.map((r) => ({ ...r, child_id: childId })),
      ),
    );
  }
  return apiClient.post<ResultsView>(`/children/${childId}/intake-responses`, {
    responses,
  });
}

export function getResults(childId: string): Promise<ResultsView> {
  if (isGuestChildId(childId))
    return Promise.resolve().then(() => getGuestResults(childId));
  return apiClient.get<ResultsView>(`/children/${childId}/results`);
}

/** Raw answer history — used to reconstruct caregiver-authored content like strengths. */
export function getIntakeResponses(childId: string): Promise<IntakeResponse[]> {
  if (isGuestChildId(childId)) {
    return Promise.resolve().then(() => getGuestIntakeResponses(childId));
  }
  return apiClient.get<IntakeResponse[]>(`/children/${childId}/intake-responses`);
}
