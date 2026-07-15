/**
 * Test double ONLY. Never register this in AppModule/AdminModule providers — production
 * always uses PrismaAdminAccountsRepository.
 */
import type { AdminAccountSummary } from '@earlysteps/shared-types';
import type { AdminAccountsRepository } from '../admin-accounts.repository.js';

export class InMemoryAdminAccountsRepository implements AdminAccountsRepository {
  constructor(private readonly accounts: AdminAccountSummary[] = []) {}

  async listAccounts(): Promise<AdminAccountSummary[]> {
    return this.accounts;
  }
}
