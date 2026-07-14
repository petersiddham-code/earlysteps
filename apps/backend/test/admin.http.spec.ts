/**
 * HTTP-level test for the Admin Console routes (issue #125): a non-admin caller (or no
 * token at all) must be rejected by every /admin/* route, and an admin caller must see
 * real data shaped per @earlysteps/shared-types' Admin* types. Mirrors auth.http.spec.ts's
 * real-Nest-HTTP-app-over-supertest pattern so @UseGuards actually runs.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import request from 'supertest';
import { AuthController } from '../src/auth/auth.controller.js';
import { AuthService } from '../src/auth/auth.service.js';
import { JwtStrategy } from '../src/auth/jwt.strategy.js';
import { AUTH_REPOSITORY } from '../src/auth/auth.repository.js';
import { InMemoryAuthRepository } from '../src/auth/testing/in-memory-auth.repository.js';
import { getJwtExpiresIn, getJwtSecret } from '../src/auth/jwt-config.js';
import { AdminController } from '../src/admin/admin.controller.js';
import { AdminService } from '../src/admin/admin.service.js';
import { AdminGuard } from '../src/admin/admin-role.guard.js';
import { ADMIN_ACCOUNTS_REPOSITORY } from '../src/admin/admin-accounts.repository.js';
import { InMemoryAdminAccountsRepository } from '../src/admin/testing/in-memory-admin-accounts.repository.js';

async function buildApp(
  authRepository: InMemoryAuthRepository,
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      PassportModule,
      JwtModule.register({
        secret: getJwtSecret(),
        signOptions: { expiresIn: getJwtExpiresIn() },
      }),
    ],
    controllers: [AuthController, AdminController],
    providers: [
      AuthService,
      JwtStrategy,
      { provide: AUTH_REPOSITORY, useValue: authRepository },
      AdminService,
      AdminGuard,
      {
        provide: ADMIN_ACCOUNTS_REPOSITORY,
        useValue: new InMemoryAdminAccountsRepository([
          {
            id: 'user-1',
            username: 'a-parent',
            tier: 'free',
            role: 'parent',
            created_at: new Date().toISOString(),
            family_count: 1,
            child_count: 2,
          },
        ]),
      },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

describe('admin routes', () => {
  let app: INestApplication;
  let authRepository: InMemoryAuthRepository;

  beforeEach(async () => {
    authRepository = new InMemoryAuthRepository();
    app = await buildApp(authRepository);
  });

  afterEach(async () => {
    await app.close();
  });

  async function registerAndPromote(username: string): Promise<string> {
    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ username, password: 'correct-horse-battery' })
      .expect(201);
    authRepository.promoteToAdmin(registered.body.user.id);
    // Re-authenticate so the returned token/user reflects the promotion — findById()
    // (via JwtStrategy) re-reads the repository on every request regardless, but this
    // keeps the login response itself consistent for any assertions on it.
    return registered.body.access_token;
  }

  for (const route of [
    '/admin/accounts',
    '/admin/content',
    '/admin/clinical-review-log',
  ]) {
    it(`${route} responds 401 with no token`, async () => {
      await request(app.getHttpServer()).get(route).expect(401);
    });

    it(`${route} responds 403 for a plain parent account`, async () => {
      const registered = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'a-parent-2', password: 'correct-horse-battery' })
        .expect(201);

      await request(app.getHttpServer())
        .get(route)
        .set('Authorization', `Bearer ${registered.body.access_token}`)
        .expect(403);
    });

    it(`${route} responds 200 for an admin account`, async () => {
      const token = await registerAndPromote('an-admin');

      await request(app.getHttpServer())
        .get(route)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  }

  it('GET /admin/accounts returns the seeded account summaries', async () => {
    const token = await registerAndPromote('an-admin-2');

    const res = await request(app.getHttpServer())
      .get('/admin/accounts')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body).toEqual([
      expect.objectContaining({ username: 'a-parent', family_count: 1, child_count: 2 }),
    ]);
  });

  it('GET /admin/content returns question bank + red-flag copy summaries', async () => {
    const token = await registerAndPromote('an-admin-3');

    const res = await request(app.getHttpServer())
      .get('/admin/content')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body.question_banks)).toBe(true);
    expect(res.body.question_banks.length).toBeGreaterThan(0);
    expect(typeof res.body.red_flag_copy_version).toBe('string');
  });

  it('GET /admin/clinical-review-log returns parsed sign-off rows', async () => {
    const token = await registerAndPromote('an-admin-4');

    const res = await request(app.getHttpServer())
      .get('/admin/clinical-review-log')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toEqual(
      expect.objectContaining({
        date: expect.any(String),
        content_version: expect.any(String),
        what_changed: expect.any(String),
        advisor: expect.any(String),
        status: expect.any(String),
      }),
    );
  });
});
