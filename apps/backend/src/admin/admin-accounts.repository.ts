/**
 * Port (interface) AdminService depends on for the DB-backed admin reads/writes. Two
 * implementations: PrismaAdminAccountsRepository (production) and an in-memory test
 * double (testing/) — never wired into AppModule.
 */
import type {
  AdminAccountSummary,
  AdminAccountUpdateInput,
} from '@earlysteps/shared-types';

export const ADMIN_ACCOUNTS_REPOSITORY = Symbol('ADMIN_ACCOUNTS_REPOSITORY');

export interface AdminAccountsRepository {
  /**
   * Account/operational metadata only — never question answers, scores, reports, free
   * text, or media (CLAUDE.md §2 rule 10's PII-minimization principle, extended to
   * admin-facing views).
   */
  listAccounts(): Promise<AdminAccountSummary[]>;

  /** Existence-and-identity lookup only, for the username-conflict check (issue #131). */
  findByUsername(username: string): Promise<{ id: string } | null>;

  /** Returns null (not found) rather than throwing — AdminService turns that into a 404. */
  updateAccount(
    id: string,
    updates: AdminAccountUpdateInput,
  ): Promise<AdminAccountSummary | null>;
}
