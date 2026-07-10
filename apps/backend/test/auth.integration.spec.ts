/**
 * Integration test for basic username/password auth (issue #94). Runs against
 * InMemoryAuthRepository — no live Postgres required.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { AuthService } from '../src/auth/auth.service.js';
import { AUTH_REPOSITORY } from '../src/auth/auth.repository.js';
import { InMemoryAuthRepository } from '../src/auth/testing/in-memory-auth.repository.js';
import { JwtStrategy } from '../src/auth/jwt.strategy.js';
import { getJwtExpiresIn, getJwtSecret } from '../src/auth/jwt-config.js';

async function buildService() {
  const repository = new InMemoryAuthRepository();
  const moduleRef = await Test.createTestingModule({
    imports: [
      // Same config source as AuthModule/JwtStrategy (jwt-config.ts) — a test-only secret
      // here would mask the exact bug this suite is meant to catch: the strategy and the
      // signing module silently disagreeing on the secret.
      JwtModule.register({
        secret: getJwtSecret(),
        signOptions: { expiresIn: getJwtExpiresIn() },
      }),
    ],
    providers: [
      AuthService,
      JwtStrategy,
      { provide: AUTH_REPOSITORY, useValue: repository },
    ],
  }).compile();
  return {
    service: moduleRef.get(AuthService),
    strategy: moduleRef.get(JwtStrategy),
    jwtService: moduleRef.get(JwtService),
    repository,
  };
}

describe('auth — register', () => {
  let service: AuthService;
  let repository: InMemoryAuthRepository;

  beforeEach(async () => {
    ({ service, repository } = await buildService());
  });

  it('creates a user and returns the public shape plus a token', async () => {
    const result = await service.register('parent1', 'correct-horse-battery');
    expect(result.user).toMatchObject({ username: 'parent1', tier: 'free' });
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(typeof result.access_token).toBe('string');
    expect(result.access_token.length).toBeGreaterThan(0);
  });

  it('never stores the plaintext password', async () => {
    await service.register('parent1', 'correct-horse-battery');
    const stored = await repository.findByUsername('parent1');
    expect(stored?.passwordHash).toBeDefined();
    expect(stored?.passwordHash).not.toBe('correct-horse-battery');
  });

  it('refuses a duplicate username', async () => {
    await service.register('parent1', 'correct-horse-battery');
    await expect(
      service.register('parent1', 'a-different-password'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('auth — login', () => {
  let service: AuthService;

  beforeEach(async () => {
    ({ service } = await buildService());
    await service.register('parent1', 'correct-horse-battery');
  });

  it('issues a token for correct credentials', async () => {
    const result = await service.login('parent1', 'correct-horse-battery');
    expect(result.user.username).toBe('parent1');
    expect(typeof result.access_token).toBe('string');
  });

  it('rejects an incorrect password', async () => {
    await expect(service.login('parent1', 'wrong-password')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an unknown username with the same error as a wrong password', async () => {
    // Never confirm whether a username exists (CLAUDE.md-style fail-safe default).
    await expect(service.login('nobody', 'anything')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});

describe('auth — upgrade', () => {
  let service: AuthService;

  beforeEach(async () => {
    ({ service } = await buildService());
  });

  it('sets tier to premium and returns the public shape', async () => {
    const { user } = await service.register('parent1', 'correct-horse-battery');
    expect(user.tier).toBe('free');

    const upgraded = await service.upgradeTier(user.id, 'premium');
    expect(upgraded).toMatchObject({ id: user.id, username: 'parent1', tier: 'premium' });
    expect(upgraded).not.toHaveProperty('passwordHash');
  });
});

describe('auth — token round-trip and strategy', () => {
  it('a token issued at login carries the user id, and the strategy resolves it back to the user', async () => {
    const { service, strategy, jwtService } = await buildService();
    const { user, access_token } = await service.register(
      'parent1',
      'correct-horse-battery',
    );

    const payload = jwtService.verify(access_token, { secret: getJwtSecret() }) as {
      sub: string;
      username: string;
    };
    expect(payload.sub).toBe(user.id);
    expect(payload.username).toBe('parent1');

    const resolved = await strategy.validate(payload);
    expect(resolved).toMatchObject({ id: user.id, username: 'parent1' });
    expect(resolved).not.toHaveProperty('passwordHash');
  });

  it('rejects a token whose subject no longer exists', async () => {
    const { strategy } = await buildService();
    await expect(
      strategy.validate({ sub: 'unknown-user', username: 'ghost' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
