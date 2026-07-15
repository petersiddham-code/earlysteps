/**
 * Test double ONLY. Never register this in AppModule/AdminModule providers — production
 * always uses PrismaAdminAccountsRepository.
 */
import type {
  AdminAccountSummary,
  AdminAccountUpdateInput,
} from '@earlysteps/shared-types';
import type { AdminAccountsRepository } from '../admin-accounts.repository.js';

export class InMemoryAdminAccountsRepository implements AdminAccountsRepository {
  constructor(private readonly accounts: AdminAccountSummary[] = []) {}

  async listAccounts(): Promise<AdminAccountSummary[]> {
    return this.accounts;
  }

  async findByUsername(username: string): Promise<{ id: string } | null> {
    const found = this.accounts.find((a) => a.username === username);
    return found ? { id: found.id } : null;
  }

  async updateAccount(
    id: string,
    updates: AdminAccountUpdateInput,
  ): Promise<AdminAccountSummary | null> {
    const index = this.accounts.findIndex((a) => a.id === id);
    const existing = this.accounts[index];
    if (!existing) return null;
    const updated: AdminAccountSummary = {
      ...existing,
      username: updates.username ?? existing.username,
      tier: updates.tier ?? existing.tier,
      role: updates.role ?? existing.role,
    };
    this.accounts[index] = updated;
    return updated;
  }

  /** Test-only helper — seeds an extra row, e.g. to line up with an id minted by /auth/register. */
  addAccount(account: AdminAccountSummary): void {
    this.accounts.push(account);
  }
}
