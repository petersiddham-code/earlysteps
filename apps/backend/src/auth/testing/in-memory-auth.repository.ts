/**
 * Test double ONLY. Never register this in AppModule/AuthModule providers — production
 * always uses PrismaAuthRepository.
 */
import type { UserTier } from '@earlysteps/shared-types';
import type { AuthRepository, CreateUserInput, StoredUser } from '../auth.repository.js';

let nextId = 0;
function generateId(): string {
  nextId += 1;
  return `user-${nextId}`;
}

export class InMemoryAuthRepository implements AuthRepository {
  private readonly usersById = new Map<string, StoredUser>();
  private readonly idByUsername = new Map<string, string>();

  async createUser(input: CreateUserInput): Promise<StoredUser> {
    const user: StoredUser = {
      id: generateId(),
      username: input.username,
      passwordHash: input.passwordHash,
      tier: 'free',
      role: 'parent',
      created_at: new Date().toISOString(),
    };
    this.usersById.set(user.id, user);
    this.idByUsername.set(user.username, user.id);
    return user;
  }

  /** Test-only helper (issue #125) — production has no self-service way to become an admin. */
  promoteToAdmin(id: string): void {
    const existing = this.usersById.get(id);
    if (!existing) throw new Error(`No user with id ${id}`);
    this.usersById.set(id, { ...existing, role: 'admin' });
  }

  async findByUsername(username: string): Promise<StoredUser | null> {
    const id = this.idByUsername.get(username);
    return id ? (this.usersById.get(id) ?? null) : null;
  }

  async findById(id: string): Promise<StoredUser | null> {
    return this.usersById.get(id) ?? null;
  }

  async updateTier(id: string, tier: UserTier): Promise<StoredUser> {
    const existing = this.usersById.get(id);
    if (!existing) throw new Error(`No user with id ${id}`);
    const updated: StoredUser = { ...existing, tier };
    this.usersById.set(id, updated);
    return updated;
  }
}
