import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AdminAccountSummary,
  AdminAccountUpdateInput,
  UserRole,
  UserTier,
} from '@earlysteps/shared-types';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AdminAccountsRepository } from './admin-accounts.repository.js';

const ACCOUNT_INCLUDE = {
  family: { include: { _count: { select: { children: true } } } },
} as const;

function toSummary(
  row: Prisma.UserGetPayload<{ include: typeof ACCOUNT_INCLUDE }>,
): AdminAccountSummary {
  return {
    id: row.id,
    username: row.username,
    tier: row.tier as UserTier,
    role: row.role as UserRole,
    created_at: row.createdAt.toISOString(),
    // Family is one-to-one (User.family? in schema.prisma) — 0 or 1, never more.
    family_count: row.family ? 1 : 0,
    child_count: row.family?._count.children ?? 0,
  };
}

@Injectable()
export class PrismaAdminAccountsRepository implements AdminAccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listAccounts(): Promise<AdminAccountSummary[]> {
    const rows = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      include: ACCOUNT_INCLUDE,
    });
    return rows.map(toSummary);
  }

  async findByUsername(username: string): Promise<{ id: string } | null> {
    return this.prisma.user.findUnique({ where: { username }, select: { id: true } });
  }

  async updateAccount(
    id: string,
    updates: AdminAccountUpdateInput,
  ): Promise<AdminAccountSummary | null> {
    try {
      const row = await this.prisma.user.update({
        where: { id },
        data: {
          ...(updates.username !== undefined ? { username: updates.username } : {}),
          ...(updates.tier !== undefined ? { tier: updates.tier } : {}),
          ...(updates.role !== undefined ? { role: updates.role } : {}),
        },
        include: ACCOUNT_INCLUDE,
      });
      return toSummary(row);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        return null;
      }
      throw err;
    }
  }
}
