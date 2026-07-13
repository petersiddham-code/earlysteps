/**
 * HTTP-level test for issue #23's multi-tenancy boundary: FamiliesController must let an
 * unowned/guest family stay exactly as open as it is today, while an account-linked family
 * only answers to that account's own JWT. Service-level tests (families.integration.spec.ts)
 * call FamiliesService directly and never go through OptionalJwtAuthGuard/
 * FamilyOwnershipGuard at all — this boots a real Nest HTTP app (mirroring
 * analysis.http.spec.ts) so both guards actually run.
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
import { FamiliesController } from '../src/families/families.controller.js';
import { FamiliesService } from '../src/families/families.service.js';
import { FAMILIES_REPOSITORY } from '../src/families/families.repository.js';
import { FamilyOwnershipGuard } from '../src/families/family-ownership.guard.js';
import { InMemoryFamiliesRepository } from '../src/families/testing/in-memory-families.repository.js';

async function buildApp(): Promise<{
  app: INestApplication;
  familiesRepository: InMemoryFamiliesRepository;
}> {
  const familiesRepository = new InMemoryFamiliesRepository();
  const moduleRef = await Test.createTestingModule({
    imports: [
      PassportModule,
      JwtModule.register({
        secret: getJwtSecret(),
        signOptions: { expiresIn: getJwtExpiresIn() },
      }),
    ],
    controllers: [AuthController, FamiliesController],
    providers: [
      AuthService,
      JwtStrategy,
      { provide: AUTH_REPOSITORY, useClass: InMemoryAuthRepository },
      FamiliesService,
      { provide: FAMILIES_REPOSITORY, useValue: familiesRepository },
      FamilyOwnershipGuard,
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return { app, familiesRepository };
}

async function registerAndGetToken(
  app: INestApplication,
  username: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/register')
    .send({ username, password: 'correct-horse-battery' })
    .expect(201);
  return res.body.access_token as string;
}

describe('FamiliesController — guest families stay fully open (no regression, issue #23)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    ({ app } = await buildApp());
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates an unowned family with no token, same as today', async () => {
    await request(app.getHttpServer())
      .post('/families')
      .send({ locale: 'en' })
      .expect(201);
  });

  it('reads/updates/deletes an unowned family with no token at all', async () => {
    const created = await request(app.getHttpServer())
      .post('/families')
      .send({ locale: 'en' })
      .expect(201);
    const familyId = created.body.id as string;

    await request(app.getHttpServer()).get(`/families/${familyId}`).expect(200);
    await request(app.getHttpServer()).get(`/families/${familyId}/children`).expect(200);
    await request(app.getHttpServer())
      .patch(`/families/${familyId}/consent`)
      .send({ scope: 'data_storage', granted: true })
      .expect(200);
    await request(app.getHttpServer()).delete(`/families/${familyId}`).expect(204);
  });

  it('an unowned family is just as reachable WITH an unrelated token, matching today', async () => {
    const created = await request(app.getHttpServer())
      .post('/families')
      .send({ locale: 'en' })
      .expect(201);
    const token = await registerAndGetToken(app, 'bystander');

    await request(app.getHttpServer())
      .get(`/families/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});

describe('FamiliesController — account recovery on a new device (issue #23)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    ({ app } = await buildApp());
  });

  afterEach(async () => {
    await app.close();
  });

  it('a logged-in caller creating a family twice recovers the SAME family, not a duplicate', async () => {
    const token = await registerAndGetToken(app, 'parent1');

    const first = await request(app.getHttpServer())
      .post('/families')
      .set('Authorization', `Bearer ${token}`)
      .send({ locale: 'en' })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/families')
      .set('Authorization', `Bearer ${token}`)
      .send({ locale: 'en' })
      .expect(201);

    expect(second.body.id).toBe(first.body.id);
  });
});

describe('FamiliesController — ownership enforcement once a family is linked (issue #23)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    ({ app } = await buildApp());
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects every route with 401 when no token is sent', async () => {
    const token = await registerAndGetToken(app, 'owner');
    const created = await request(app.getHttpServer())
      .post('/families')
      .set('Authorization', `Bearer ${token}`)
      .send({ locale: 'en' })
      .expect(201);
    const familyId = created.body.id as string;

    await request(app.getHttpServer()).get(`/families/${familyId}`).expect(401);
    await request(app.getHttpServer()).get(`/families/${familyId}/children`).expect(401);
    await request(app.getHttpServer())
      .patch(`/families/${familyId}/consent`)
      .send({ scope: 'data_storage', granted: true })
      .expect(401);
    await request(app.getHttpServer()).delete(`/families/${familyId}`).expect(401);
  });

  it('rejects a different logged-in account with 403, even with a valid token', async () => {
    const ownerToken = await registerAndGetToken(app, 'owner');
    const strangerToken = await registerAndGetToken(app, 'stranger');
    const created = await request(app.getHttpServer())
      .post('/families')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ locale: 'en' })
      .expect(201);
    const familyId = created.body.id as string;

    await request(app.getHttpServer())
      .get(`/families/${familyId}`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/families/${familyId}/children`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .expect(403);
  });

  it('allows the owning account through to read, update, and delete its own family', async () => {
    const ownerToken = await registerAndGetToken(app, 'owner');
    const created = await request(app.getHttpServer())
      .post('/families')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ locale: 'en' })
      .expect(201);
    const familyId = created.body.id as string;

    await request(app.getHttpServer())
      .get(`/families/${familyId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/families/${familyId}/children`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/families/${familyId}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(204);
  });

  it('getChild under an owned family is also gated (401/403/200)', async () => {
    const ownerToken = await registerAndGetToken(app, 'owner');
    const strangerToken = await registerAndGetToken(app, 'stranger');
    const created = await request(app.getHttpServer())
      .post('/families')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ locale: 'en' })
      .expect(201);
    const familyId = created.body.id as string;
    const child = await request(app.getHttpServer())
      .post(`/families/${familyId}/children`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        nickname: 'Alex',
        birth_month: 1,
        birth_year: 2023,
        languages: ['English'],
      })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/families/${familyId}/children/${child.body.id}`)
      .expect(401);
    await request(app.getHttpServer())
      .get(`/families/${familyId}/children/${child.body.id}`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/families/${familyId}/children/${child.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });
});
