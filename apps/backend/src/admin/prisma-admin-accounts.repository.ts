import { Injectable } from '@nestjs/common';
import type { AdminAccountSummary, UserRole, UserTier } from '@earlysteps/shared-types';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminAccountsRepository } from './admin-accounts.repository.js';

@Injectable()
export class PrismaAdminAccountsRepository implements AdminAccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listAccounts(): Promise<AdminAccountSummary[]> {
    const rows = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        family: {
          include: { _count: { select: { children: true } } },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      username: row.username,
      tier: row.tier as UserTier,
      role: row.role as UserRole,
      created_at: row.createdAt.toISOString(),
      // Family is one-to-one (User.family? in schema.prisma) — 0 or 1, never more.
      family_count: row.family ? 1 : 0,
      child_count: row.family?._count.children ?? 0,
    }));
  }
}
