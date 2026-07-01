import type { AgeBand, Child, ConsentScope, Family } from '@earlysteps/shared-types';
import { apiClient } from './client.js';

export interface CreateFamilyInput {
  locale: string;
  low_bandwidth_mode?: boolean;
}

export interface CreateChildInput {
  nickname: string;
  age_band: AgeBand;
  languages: string[];
}

export function createFamily(input: CreateFamilyInput): Promise<Family> {
  return apiClient.post<Family>('/families', input);
}

export function getFamily(familyId: string): Promise<Family> {
  return apiClient.get<Family>(`/families/${familyId}`);
}

/** Updates exactly one consent scope — matches <ConsentToggle/>'s one-scope-per-call UX. */
export function updateConsent(
  familyId: string,
  scope: ConsentScope,
  granted: boolean,
): Promise<Family> {
  return apiClient.patch<Family>(`/families/${familyId}/consent`, { scope, granted });
}

export function createChild(familyId: string, input: CreateChildInput): Promise<Child> {
  return apiClient.post<Child>(`/families/${familyId}/children`, input);
}

export function getChild(familyId: string, childId: string): Promise<Child> {
  return apiClient.get<Child>(`/families/${familyId}/children/${childId}`);
}
