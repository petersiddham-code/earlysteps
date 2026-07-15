/**
 * Port AdminService depends on for content-draft storage (issue #127). Two implementations:
 * PrismaContentDraftsRepository (production) and an in-memory test double (testing/) —
 * never wired into AppModule. Mirrors the admin-accounts.repository.ts pattern.
 */
import type { AdminContentDraft } from '@earlysteps/shared-types';

export const CONTENT_DRAFTS_REPOSITORY = Symbol('CONTENT_DRAFTS_REPOSITORY');

export interface CreateContentDraftInput {
  contentKey: string;
  fieldPath: string;
  currentValue: string;
  proposedValue: string;
  note: string;
  createdById: string;
}

export interface ContentDraftsRepository {
  create(input: CreateContentDraftInput): Promise<AdminContentDraft>;
  /** All open (pending) drafts, optionally filtered to one content key. */
  listPending(contentKey?: string): Promise<AdminContentDraft[]>;
  /** Marks a draft discarded. No-op (returns false) if it doesn't exist or is already discarded. */
  discard(draftId: string): Promise<boolean>;
}
