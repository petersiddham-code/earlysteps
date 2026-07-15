import type {
  AdminAccountSummary,
  AdminClinicalReviewLogEntry,
  AdminContentDetail,
  AdminContentDraft,
  AdminContentDraftInput,
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

/**
 * Issue #127: draft-only content editing. None of these routes ever writes
 * packages/content — a draft is a proposal a maintainer still turns into a reviewed PR
 * with clinical sign-off (docs/clinical-review/2026-07-15-issue127-admin-content-editing-plan.md).
 */
export function getAdminContentDetail(contentKey: string): Promise<AdminContentDetail> {
  return apiClient.get<AdminContentDetail>(
    `/admin/content/${encodeURIComponent(contentKey)}`,
  );
}

export function createAdminContentDraft(
  contentKey: string,
  input: AdminContentDraftInput,
): Promise<AdminContentDraft> {
  return apiClient.post<AdminContentDraft>(
    `/admin/content/${encodeURIComponent(contentKey)}/drafts`,
    input,
  );
}

export function getAdminContentDrafts(contentKey?: string): Promise<AdminContentDraft[]> {
  const query = contentKey ? `?content_key=${encodeURIComponent(contentKey)}` : '';
  return apiClient.get<AdminContentDraft[]>(`/admin/content/drafts${query}`);
}

export function discardAdminContentDraft(draftId: string): Promise<void> {
  return apiClient.delete(`/admin/content/drafts/${encodeURIComponent(draftId)}`);
}
