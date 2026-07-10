import { Injectable } from '@nestjs/common';
import type { UserTier } from '@earlysteps/shared-types';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthRepository, CreateUserInput, StoredUser } from './auth.repository.js';

function toStoredUser(row: {
  id: string;
  username: string;
  passwordHash: string;
  tier: string;
  createdAt: Date;
}): StoredUser {
  return {
    id: row.id,
    username: row.username,
    passwordHash: row.passwordHash,
    tier: row.tier as UserTier,
    created_at: row.createdAt.toISOString(),
  };
}

@Injectable()
export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(input: CreateUserInput): Promise<StoredUser> {
    const row = await this.prisma.user.create({
      data: { username: input.username, passwordHash: input.passwordHash },
    });
    return toStoredUser(row);
  }

  async findByUsername(username: string): Promise<StoredUser | null> {
    const row = await this.prisma.user.findUnique({ where: { username } });
    return row ? toStoredUser(row) : null;
  }

  async findById(id: string): Promise<StoredUser | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? toStoredUser(row) : null;
  }

  async updateTier(id: string, tier: UserTier): Promise<StoredUser> {
    const row = await this.prisma.user.update({ where: { id }, data: { tier } });
    return toStoredUser(row);
  }
}
