/**
 * HTTP-level test for the Admin Console routes (issue #125): a non-admin caller (or no
 * token at all) must be rejected by every /admin/* route, and an admin caller must see
 * real data shaped per @earlysteps/shared-types' Admin* types. Mirrors auth.http.spec.ts's
 * real-Nest-HTTP-app-over-supertest pattern so @UseGuards actually runs.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
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
import { CONTENT_DRAFTS_REPOSITORY } from '../src/admin/content-drafts.repository.js';
import { InMemoryContentDraftsRepository } from '../src/admin/testing/in-memory-content-drafts.repository.js';

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
      {
        provide: CONTENT_DRAFTS_REPOSITORY,
        useValue: new InMemoryContentDraftsRepository(),
      },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
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
    '/admin/content/drafts',
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

  describe('content editing (issue #127) — draft-only', () => {
    it('GET /admin/content/:contentKey lists editable fields but never fixed vocabulary or the disclaimer', async () => {
      const token = await registerAndPromote('an-admin-5');

      const res = await request(app.getHttpServer())
        .get('/admin/content/result-copy.labels')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.content_key).toBe('result-copy.labels');
      const paths = res.body.fields.map((f: { path: string }) => f.path);
      expect(paths).toContain('card_heading');
      expect(paths).toContain('red_flag_confidence_note');
      expect(paths).toContain('insufficient_evidence.explanation');
      // Locked: fixed CLAUDE.md §2 rule 2/3/5 vocabulary and the verbatim disclaimer.
      expect(paths).not.toContain('disclaimer');
      expect(paths).not.toContain('sign_level_labels.low');
      expect(paths).not.toContain('recommendation_tiers.begin');
      expect(paths).not.toContain('support_level_terms.mild');
      // Locked: matched against INSUFFICIENT_EVIDENCE_LABEL elsewhere in the pipeline.
      expect(paths).not.toContain('insufficient_evidence.label');
    });

    it('GET /admin/content/:contentKey only exposes text/hint for question banks, never option ids', async () => {
      const token = await registerAndPromote('an-admin-6');

      const res = await request(app.getHttpServer())
        .get('/admin/content/questions.toddler')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const paths: string[] = res.body.fields.map((f: { path: string }) => f.path);
      expect(paths.length).toBeGreaterThan(0);
      for (const path of paths) {
        expect(path.endsWith('.text') || path.endsWith('.hint')).toBe(true);
      }
      expect(paths.some((p) => p.includes('.options'))).toBe(false);
    });

    it('GET /admin/content/:contentKey 404s for an unregistered key', async () => {
      const token = await registerAndPromote('an-admin-7');

      await request(app.getHttpServer())
        .get('/admin/content/weights.domain-weights')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('drafts a valid edit, lists it, then discards it', async () => {
      const token = await registerAndPromote('an-admin-8');
      const auth = { Authorization: `Bearer ${token}` };

      const created = await request(app.getHttpServer())
        .post('/admin/content/result-copy.labels/drafts')
        .set(auth)
        .send({
          field_path: 'card_heading',
          proposed_value: 'Your screening results',
          note: 'Testing whether a friendlier heading reads better to caregivers.',
        })
        .expect(201);

      expect(created.body).toEqual(
        expect.objectContaining({
          content_key: 'result-copy.labels',
          field_path: 'card_heading',
          current_value: 'Screening results',
          proposed_value: 'Your screening results',
          status: 'pending',
        }),
      );

      const listed = await request(app.getHttpServer())
        .get('/admin/content/drafts')
        .set(auth)
        .expect(200);
      expect(listed.body).toEqual([expect.objectContaining({ id: created.body.id })]);

      const scoped = await request(app.getHttpServer())
        .get('/admin/content/drafts?content_key=result-copy.labels')
        .set(auth)
        .expect(200);
      expect(scoped.body).toEqual([expect.objectContaining({ id: created.body.id })]);

      await request(app.getHttpServer())
        .delete(`/admin/content/drafts/${created.body.id}`)
        .set(auth)
        .expect(204);

      const afterDiscard = await request(app.getHttpServer())
        .get('/admin/content/drafts')
        .set(auth)
        .expect(200);
      expect(afterDiscard.body).toEqual([]);
    });

    it('DELETE /admin/content/drafts/:draftId 404s for an already-discarded or unknown id', async () => {
      const token = await registerAndPromote('an-admin-9');

      await request(app.getHttpServer())
        .delete('/admin/content/drafts/does-not-exist')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('rejects a draft for a field outside the registry allowlist', async () => {
      const token = await registerAndPromote('an-admin-10');

      await request(app.getHttpServer())
        .post('/admin/content/result-copy.labels/drafts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          field_path: 'disclaimer',
          proposed_value: 'Some other disclaimer text entirely.',
          note: 'Trying to change the disclaimer.',
        })
        .expect(400);
    });

    it('rejects a draft containing banned/reserved language (fail closed)', async () => {
      const token = await registerAndPromote('an-admin-11');

      await request(app.getHttpServer())
        .post('/admin/content/result-copy.labels/drafts')
        .set('Authorization', `Bearer ${token}`)
        .send({
          field_path: 'card_heading',
          proposed_value: 'Your child has an abnormal result',
          note: 'Bad example.',
        })
        .expect(400);
    });

    it('rejects a draft with an empty note', async () => {
      const token = await registerAndPromote('an-admin-12');

      await request(app.getHttpServer())
        .post('/admin/content/result-copy.labels/drafts')
        .set('Authorization', `Bearer ${token}`)
        .send({ field_path: 'card_heading', proposed_value: 'Fine copy.', note: '' })
        .expect(400);
    });

    it('rejects a draft for an unregistered content key', async () => {
      const token = await registerAndPromote('an-admin-13');

      await request(app.getHttpServer())
        .post('/admin/content/weights.domain-weights/drafts')
        .set('Authorization', `Bearer ${token}`)
        .send({ field_path: 'version', proposed_value: '9.9.9', note: 'nope' })
        .expect(404);
    });

    it('a plain parent account cannot read or create drafts', async () => {
      const registered = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ username: 'a-parent-3', password: 'correct-horse-battery' })
        .expect(201);
      const auth = { Authorization: `Bearer ${registered.body.access_token}` };

      await request(app.getHttpServer())
        .get('/admin/content/result-copy.labels')
        .set(auth)
        .expect(403);

      await request(app.getHttpServer())
        .post('/admin/content/result-copy.labels/drafts')
        .set(auth)
        .send({ field_path: 'card_heading', proposed_value: 'x', note: 'x' })
        .expect(403);
    });
  });
});
