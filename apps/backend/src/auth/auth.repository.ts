/**
 * Port (interface) AuthService depends on. Two implementations exist:
 *  - PrismaAuthRepository (production, real Postgres via Prisma)
 *  - InMemoryAuthRepository (test double, testing/ — never wired into AppModule)
 */
import type { User, UserTier } from '@earlysteps/shared-types';

export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

export interface CreateUserInput {
  username: string;
  passwordHash: string;
}

/** Internal-only shape — carries the hash the public `User` type never exposes. */
export interface StoredUser extends User {
  passwordHash: string;
}

export interface AuthRepository {
  createUser(input: CreateUserInput): Promise<StoredUser>;
  findByUsername(username: string): Promise<StoredUser | null>;
  findById(id: string): Promise<StoredUser | null>;
  /** Issue #99: self-service tier change (no payment flow — see content-gaps.md §6). */
  updateTier(id: string, tier: UserTier): Promise<StoredUser>;
}
