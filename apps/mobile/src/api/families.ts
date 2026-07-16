import type {
  Child,
  ConsentScope,
  Family,
  GenderOption,
  MediaRetentionDays,
} from '@earlysteps/shared-types';
import { apiClient } from './client.js';
import { getGuestChild, isGuestChildId } from '../guest/guestStore.js';

export interface CreateFamilyInput {
  locale: string;
  low_bandwidth_mode?: boolean;
}

export interface CreateChildInput {
  nickname: string;
  /** Month (1–12) + year of birth — the age band is derived server-side, never sent (#25). */
  birth_month: number;
  birth_year: number;
  gender?: GenderOption;
  gender_detail?: string;
  languages: string[];
}

export function createFamily(input: CreateFamilyInput): Promise<Family> {
  return apiClient.post<Family>('/families', input);
}

export function getFamily(familyId: string): Promise<Family> {
  return apiClient.get<Family>(`/families/${familyId}`);
}

/** The child switcher's data source (issue #23) — every child recorded under this family. */
export function getChildren(familyId: string): Promise<Child[]> {
  return apiClient.get<Child[]>(`/families/${familyId}/children`);
}

/** Updates exactly one consent scope — matches <ConsentToggle/>'s one-scope-per-call UX. */
export function updateConsent(
  familyId: string,
  scope: ConsentScope,
  granted: boolean,
): Promise<Family> {
  return apiClient.patch<Family>(`/families/${familyId}/consent`, { scope, granted });
}

/** Parent-facing media retention window (issue #142) — 30/60/90 days, retroactive. */
export function updateMediaRetention(
  familyId: string,
  days: MediaRetentionDays,
): Promise<Family> {
  return apiClient.patch<Family>(`/families/${familyId}/media-retention`, { days });
}

export function createChild(familyId: string, input: CreateChildInput): Promise<Child> {
  return apiClient.post<Child>(`/families/${familyId}/children`, input);
}

export function getChild(familyId: string, childId: string): Promise<Child> {
  // Guest/ephemeral child (issue #63): never persisted server-side, so this reads the
  // in-memory guest store instead of the backend — same signature, transparent to callers.
  if (isGuestChildId(childId))
    return Promise.resolve().then(() => getGuestChild(childId));
  return apiClient.get<Child>(`/families/${familyId}/children/${childId}`);
}

/**
 * Right-to-erasure (issue #55): permanently deletes the family and everything stored
 * under it — child details, answers, results. Irreversible; callers must show their own
 * confirmation step first.
 */
export function deleteFamily(familyId: string): Promise<void> {
  return apiClient.delete(`/families/${familyId}`);
}
