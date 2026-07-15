/**
 * Test double ONLY. Never register this in AppModule/AdminModule providers — production
 * always uses PrismaContentDraftsRepository.
 */
import type { AdminContentDraft } from '@earlysteps/shared-types';
import type {
  ContentDraftsRepository,
  CreateContentDraftInput,
} from '../content-drafts.repository.js';

export class InMemoryContentDraftsRepository implements ContentDraftsRepository {
  private drafts: AdminContentDraft[] = [];
  private nextId = 1;

  constructor(private readonly usernameById: Record<string, string> = {}) {}

  async create(input: CreateContentDraftInput): Promise<AdminContentDraft> {
    const draft: AdminContentDraft = {
      id: `draft-${this.nextId++}`,
      content_key: input.contentKey,
      field_path: input.fieldPath,
      current_value: input.currentValue,
      proposed_value: input.proposedValue,
      note: input.note,
      created_by: this.usernameById[input.createdById] ?? input.createdById,
      created_at: new Date().toISOString(),
      status: 'pending',
    };
    this.drafts.push(draft);
    return draft;
  }

  async listPending(contentKey?: string): Promise<AdminContentDraft[]> {
    return this.drafts
      .filter((d) => d.status === 'pending')
      .filter((d) => !contentKey || d.content_key === contentKey);
  }

  async discard(draftId: string): Promise<boolean> {
    const draft = this.drafts.find((d) => d.id === draftId && d.status === 'pending');
    if (!draft) return false;
    draft.status = 'discarded';
    return true;
  }
}
