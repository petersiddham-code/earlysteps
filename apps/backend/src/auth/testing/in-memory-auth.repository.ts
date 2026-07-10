/**
 * Test double ONLY. Never register this in AppModule/AuthModule providers — production
 * always uses PrismaAuthRepository.
 */
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
      created_at: new Date().toISOString(),
    };
    this.usersById.set(user.id, user);
    this.idByUsername.set(user.username, user.id);
    return user;
  }

  async findByUsername(username: string): Promise<StoredUser | null> {
    const id = this.idByUsername.get(username);
    return id ? (this.usersById.get(id) ?? null) : null;
  }

  async findById(id: string): Promise<StoredUser | null> {
    return this.usersById.get(id) ?? null;
  }
}
