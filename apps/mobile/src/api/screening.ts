import type { IntakeResponse, ResultsView } from '@earlysteps/shared-types';
import { apiClient } from './client.js';

/** The subset of IntakeResponse the backend DTO accepts — child_id is added server-side. */
export type IntakeResponseInput = Omit<IntakeResponse, 'child_id'>;

export function submitIntakeResponses(
  childId: string,
  responses: IntakeResponseInput[],
): Promise<ResultsView> {
  return apiClient.post<ResultsView>(`/children/${childId}/intake-responses`, {
    responses,
  });
}

export function getResults(childId: string): Promise<ResultsView> {
  return apiClient.get<ResultsView>(`/children/${childId}/results`);
}

/** Raw answer history — used to reconstruct caregiver-authored content like strengths. */
export function getIntakeResponses(childId: string): Promise<IntakeResponse[]> {
  return apiClient.get<IntakeResponse[]>(`/children/${childId}/intake-responses`);
}
