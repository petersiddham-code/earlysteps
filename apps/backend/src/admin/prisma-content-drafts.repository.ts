import { Injectable } from '@nestjs/common';
import type { AdminContentDraft } from '@earlysteps/shared-types';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  ContentDraftsRepository,
  CreateContentDraftInput,
} from './content-drafts.repository.js';

function toAdminContentDraft(row: {
  id: string;
  contentKey: string;
  fieldPath: string;
  currentValue: string;
  proposedValue: string;
  note: string;
  createdAt: Date;
  status: string;
  createdBy: { username: string };
}): AdminContentDraft {
  return {
    id: row.id,
    content_key: row.contentKey,
    field_path: row.fieldPath,
    current_value: row.currentValue,
    proposed_value: row.proposedValue,
    note: row.note,
    created_by: row.createdBy.username,
    created_at: row.createdAt.toISOString(),
    status: row.status as AdminContentDraft['status'],
  };
}

@Injectable()
export class PrismaContentDraftsRepository implements ContentDraftsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateContentDraftInput): Promise<AdminContentDraft> {
    const row = await this.prisma.contentDraft.create({
      data: {
        contentKey: input.contentKey,
        fieldPath: input.fieldPath,
        currentValue: input.currentValue,
        proposedValue: input.proposedValue,
        note: input.note,
        createdById: input.createdById,
      },
      include: { createdBy: { select: { username: true } } },
    });
    return toAdminContentDraft(row);
  }

  async listPending(contentKey?: string): Promise<AdminContentDraft[]> {
    const rows = await this.prisma.contentDraft.findMany({
      where: { status: 'pending', ...(contentKey ? { contentKey } : {}) },
      include: { createdBy: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toAdminContentDraft);
  }

  async discard(draftId: string): Promise<boolean> {
    const result = await this.prisma.contentDraft.updateMany({
      where: { id: draftId, status: 'pending' },
      data: { status: 'discarded', discardedAt: new Date() },
    });
    return result.count > 0;
  }
}
