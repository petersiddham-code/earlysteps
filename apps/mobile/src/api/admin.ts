import type {
  AdminAccountSummary,
  AdminClinicalReviewLogEntry,
  AdminContentSummary,
} from '@earlysteps/shared-types';
import { apiClient } from './client.js';

/** Issue #125: read-only Admin Console endpoints — every route 403s for a non-admin caller. */
export function getAdminAccounts(): Promise<AdminAccountSummary[]> {
  return apiClient.get<AdminAccountSummary[]>('/admin/accounts');
}

export function getAdminContentSummary(): Promise<AdminContentSummary> {
  return apiClient.get<AdminContentSummary>('/admin/content');
}

export function getAdminClinicalReviewLog(): Promise<AdminClinicalReviewLogEntry[]> {
  return apiClient.get<AdminClinicalReviewLogEntry[]>('/admin/clinical-review-log');
}
