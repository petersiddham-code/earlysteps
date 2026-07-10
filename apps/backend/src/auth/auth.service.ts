import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
// Default import, not `import * as bcrypt` — under ts-node/esm's CJS interop (unlike
// vitest's esbuild transform) a namespace import silently drops bcryptjs's methods.
import bcrypt from 'bcryptjs';
import type { User, UserTier } from '@earlysteps/shared-types';
import {
  AUTH_REPOSITORY,
  type AuthRepository,
  type StoredUser,
} from './auth.repository.js';

const BCRYPT_SALT_ROUNDS = 10;

export interface AuthResult {
  user: User;
  access_token: string;
}

function toPublicUser(stored: StoredUser): User {
  return {
    id: stored.id,
    username: stored.username,
    tier: stored.tier,
    created_at: stored.created_at,
  };
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly repository: AuthRepository,
    // Explicit token: vitest's esbuild transform emits no decorator design:paramtypes
    // metadata, so class-typed constructor injection resolves to undefined in tests.
    @Inject(JwtService) private readonly jwtService: JwtService,
  ) {}

  async register(username: string, password: string): Promise<AuthResult> {
    const existing = await this.repository.findByUsername(username);
    if (existing) {
      throw new ConflictException('That username is already taken.');
    }
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    const stored = await this.repository.createUser({ username, passwordHash });
    return this.issueToken(stored);
  }

  async login(username: string, password: string): Promise<AuthResult> {
    const stored = await this.repository.findByUsername(username);
    // Same error for "no such user" and "wrong password" — never confirm a username exists.
    if (!stored || !(await bcrypt.compare(password, stored.passwordHash))) {
      throw new UnauthorizedException('Incorrect username or password.');
    }
    return this.issueToken(stored);
  }

  async findById(id: string): Promise<User | null> {
    const stored = await this.repository.findById(id);
    return stored ? toPublicUser(stored) : null;
  }

  /**
   * Issue #99: a free-tier account can self-upgrade to premium — there's no payment
   * gateway in this app yet, so this is a deliberate stub (docs/clinical-review/
   * content-gaps.md §6). One-directional: no downgrade path, matching the issue's ask.
   */
  async upgradeTier(userId: string, tier: UserTier): Promise<User> {
    const stored = await this.repository.updateTier(userId, tier);
    return toPublicUser(stored);
  }

  private issueToken(stored: StoredUser): AuthResult {
    const user = toPublicUser(stored);
    const access_token = this.jwtService.sign({ sub: user.id, username: user.username });
    return { user, access_token };
  }
}
