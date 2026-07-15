import { Inject, Injectable } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { QUESTION_BANKS, RED_FLAG_COPY } from '@earlysteps/content';
import type {
  AdminAccountSummary,
  AdminClinicalReviewLogEntry,
  AdminContentSummary,
} from '@earlysteps/shared-types';
import {
  ADMIN_ACCOUNTS_REPOSITORY,
  type AdminAccountsRepository,
} from './admin-accounts.repository.js';

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
}
