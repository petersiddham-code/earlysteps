import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { QUESTION_BANKS, RED_FLAG_COPY } from '@earlysteps/content';
import { containsBannedOrReservedLanguage } from '@earlysteps/shared-types';
import type {
  AdminAccountSummary,
  AdminClinicalReviewLogEntry,
  AdminContentDetail,
  AdminContentDraft,
  AdminContentDraftInput,
  AdminContentSummary,
} from '@earlysteps/shared-types';
import {
  ADMIN_ACCOUNTS_REPOSITORY,
  type AdminAccountsRepository,
} from './admin-accounts.repository.js';
import {
  CONTENT_DRAFTS_REPOSITORY,
  type ContentDraftsRepository,
} from './content-drafts.repository.js';
import {
  findEditableField,
  isEditableContentKey,
  listEditableFields,
} from './admin-content-registry.js';

/** Generous but bounded — this is caregiver-facing copy, not a document upload. */
const MAX_PROPOSED_VALUE_LENGTH = 2000;
const MAX_NOTE_LENGTH = 1000;

/**
 * Same stable path-resolution trick as analysis/prompt.ts's PROMPTS_DIR: relative to this
 * file, not process.cwd(), so it works under ts-node dev, vitest, and CI alike.
 */
const CLINICAL_REVIEW_README = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../docs/clinical-review/README.md',
);

/**
 * Parses the "## Sign-off log" markdown table in docs/clinical-review/README.md into
 * structured rows. Read-only surface for the Admin Console (issue #125) — this file
 * itself is still the single source of truth; nothing here writes back to it.
 */
export function parseSignOffLog(markdown: string): AdminClinicalReviewLogEntry[] {
  const lines = markdown.split('\n');
  const tableStart = lines.findIndex((line) => line.trim().startsWith('| Date '));
  if (tableStart === -1) return [];

  const rows: AdminClinicalReviewLogEntry[] = [];
  // tableStart + 1 is the `|---|---|...` separator row — data starts after it.
  for (const line of lines.slice(tableStart + 2)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) break;
    const cells = trimmed
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 5) continue;
    const [date, contentVersion, whatChanged, advisor, status] = cells as [
      string,
      string,
      string,
      string,
      string,
    ];
    rows.push({
      date,
      content_version: contentVersion,
      what_changed: whatChanged,
      advisor,
      status,
    });
  }
  return rows;
}

@Injectable()
export class AdminService {
  constructor(
    @Inject(ADMIN_ACCOUNTS_REPOSITORY)
    private readonly accountsRepository: AdminAccountsRepository,
    @Inject(CONTENT_DRAFTS_REPOSITORY)
    private readonly contentDraftsRepository: ContentDraftsRepository,
  ) {}

  listAccounts(): Promise<AdminAccountSummary[]> {
    return this.accountsRepository.listAccounts();
  }

  getContentSummary(): AdminContentSummary {
    return {
      question_banks: Object.entries(QUESTION_BANKS).map(([ageBand, bank]) => ({
        age_band: ageBand,
        locale: bank.locale,
        version: bank.version,
        question_count: bank.questions.length,
      })),
      red_flag_copy_version: RED_FLAG_COPY.version,
      red_flag_copy_needs_signoff: RED_FLAG_COPY.needs_clinical_signoff,
    };
  }

  getClinicalReviewLog(): AdminClinicalReviewLogEntry[] {
    const markdown = readFileSync(CLINICAL_REVIEW_README, 'utf8');
    return parseSignOffLog(markdown);
  }

  /**
   * The current, live, draftable fields for one content key (issue #127). 404s rather than
   * returning an empty list for an unregistered key — a client asking about a key outside
   * admin-content-registry.ts's allowlist gets a clear signal it isn't editable, not a
   * silently empty screen.
   */
  getContentDetail(contentKey: string): AdminContentDetail {
    if (!isEditableContentKey(contentKey)) {
      throw new NotFoundException(`'${contentKey}' is not an editable content key.`);
    }
    return { content_key: contentKey, fields: listEditableFields(contentKey) };
  }

  /**
   * Records a proposed edit as a pending draft. Never writes packages/content — see
   * docs/clinical-review/2026-07-15-issue127-admin-content-editing-plan.md. Fails closed
   * (CLAUDE.md §8): an unregistered content key, a field outside the registry's current
   * allowlist, an empty/oversized value, or banned/reserved language all reject with 400
   * rather than being silently accepted and only caught later at PR review time.
   */
  async createContentDraft(
    contentKey: string,
    input: AdminContentDraftInput,
    createdById: string,
  ): Promise<AdminContentDraft> {
    if (!isEditableContentKey(contentKey)) {
      throw new NotFoundException(`'${contentKey}' is not an editable content key.`);
    }

    const field = findEditableField(contentKey, input.field_path);
    if (!field) {
      throw new BadRequestException(
        `'${input.field_path}' is not a draftable field of '${contentKey}'.`,
      );
    }

    const proposedValue = input.proposed_value.trim();
    const note = input.note.trim();
    if (!proposedValue) {
      throw new BadRequestException('proposed_value must not be empty.');
    }
    if (proposedValue.length > MAX_PROPOSED_VALUE_LENGTH) {
      throw new BadRequestException(
        `proposed_value must be ${MAX_PROPOSED_VALUE_LENGTH} characters or fewer.`,
      );
    }
    if (!note) {
      throw new BadRequestException(
        'note is required — explain why this change is proposed.',
      );
    }
    if (note.length > MAX_NOTE_LENGTH) {
      throw new BadRequestException(
        `note must be ${MAX_NOTE_LENGTH} characters or fewer.`,
      );
    }
    if (containsBannedOrReservedLanguage(proposedValue)) {
      throw new BadRequestException(
        'proposed_value contains banned or reserved language (CLAUDE.md §2 rules 2–4) and cannot be drafted.',
      );
    }

    return this.contentDraftsRepository.create({
      contentKey,
      fieldPath: input.field_path,
      currentValue: field.current_value,
      proposedValue,
      note,
      createdById,
    });
  }

  /** Open drafts, optionally scoped to one content key. */
  listContentDrafts(contentKey?: string): Promise<AdminContentDraft[]> {
    return this.contentDraftsRepository.listPending(contentKey);
  }

  async discardContentDraft(draftId: string): Promise<void> {
    const discarded = await this.contentDraftsRepository.discard(draftId);
    if (!discarded) {
      throw new NotFoundException(`No pending draft '${draftId}'.`);
    }
  }
}
