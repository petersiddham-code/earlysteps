/**
 * Port (interface) AdminService depends on for the one DB-backed admin read. Two
 * implementations: PrismaAdminAccountsRepository (production) and an in-memory test
 * double (testing/) — never wired into AppModule.
 */
import type { AdminAccountSummary } from '@earlysteps/shared-types';

export const ADMIN_ACCOUNTS_REPOSITORY = Symbol('ADMIN_ACCOUNTS_REPOSITORY');

export interface AdminAccountsRepository {
  /**
   * Account/operational metadata only — never question answers, scores, reports, free
   * text, or media (CLAUDE.md §2 rule 10's PII-minimization principle, extended to
   * admin-facing views).
   */
  listAccounts(): Promise<AdminAccountSummary[]>;
}
