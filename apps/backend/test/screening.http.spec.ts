/**
 * HTTP-level test for issue #23's multi-tenancy boundary on ScreeningController: a child
 * under an account-linked family only answers to that account's own JWT; a child under an
 * unowned/guest family stays exactly as open as it is today. Service-level tests
 * (screening.integration.spec.ts) call ScreeningService directly and never go through
 * OptionalJwtAuthGuard/FamilyOwnershipGuard at all — this boots a real Nest HTTP app
 * (mirroring analysis.http.spec.ts) so both guards actually run.
 */
import { describe, it, beforeEach, afterEach } from 'vitest';
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
import { ScreeningController } from '../src/screening/screening.controller.js';
import { ScreeningService } from '../src/screening/screening.service.js';
import { SCREENING_REPOSITORY } from '../src/screening/screening.repository.js';
import { InMemoryScreeningRepository } from '../src/screening/testing/in-memory-screening.repository.js';
import { FAMILIES_REPOSITORY } from '../src/families/families.repository.js';
import { FamilyOwnershipGuard } from '../src/families/family-ownership.guard.js';
import { InMemoryFamiliesRepository } from '../src/families/testing/in-memory-families.repository.js';

async function buildApp(): Promise<{
  app: INestApplication;
  familiesRepository: InMemoryFamiliesRepository;
}> {
  const familiesRepository = new InMemoryFamiliesRepository();
  const screeningRepository = new InMemoryScreeningRepository();
  const moduleRef = await Test.createTestingModule({
    imports: [
      PassportModule,
      JwtModule.register({
        secret: getJwtSecret(),
        signOptions: { expiresIn: getJwtExpiresIn() },
      }),
    ],
    controllers: [AuthController, ScreeningController],
    providers: [
      AuthService,
      JwtStrategy,
      { provide: AUTH_REPOSITORY, useClass: InMemoryAuthRepository },
      ScreeningService,
      { provide: SCREENING_REPOSITORY, useValue: screeningRepository },
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

describe('ScreeningController — a child under an unowned/guest family stays open (issue #23)', () => {
  let app: INestApplication;
  let familiesRepository: InMemoryFamiliesRepository;

  beforeEach(async () => {
    ({ app, familiesRepository } = await buildApp());
  });

  afterEach(async () => {
    await app.close();
  });

  it('reads results and intake responses with no token at all, same as today', async () => {
    const { child } = await familiesRepository.seedChildWithConsent(['data_storage']);

    await request(app.getHttpServer())
      .post(`/children/${child.id}/intake-responses`)
      .send({
        responses: [
          {
            question_id: 'T1',
            domain: 'communication',
            answer: 'before_12mo',
            timestamp: '2026-07-01T00:00:00.000Z',
          },
        ],
      })
      .expect(201);
    await request(app.getHttpServer()).get(`/children/${child.id}/results`).expect(200);
    await request(app.getHttpServer())
      .get(`/children/${child.id}/intake-responses`)
      .expect(200);
  });
});

describe('ScreeningController — ownership enforcement once the family is linked (issue #23)', () => {
  let app: INestApplication;
  let familiesRepository: InMemoryFamiliesRepository;

  beforeEach(async () => {
    ({ app, familiesRepository } = await buildApp());
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects 401 with no token, 403 for a different account, 200 for the owner', async () => {
    const ownerToken = await registerAndGetToken(app, 'owner');
    const strangerToken = await registerAndGetToken(app, 'stranger');
    const ownerId = (
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Authorization', `Bearer ${ownerToken}`)
    ).body.id as string;
    const { child } = await familiesRepository.seedChildWithConsent(
      ['data_storage'],
      undefined,
      ownerId,
    );

    await request(app.getHttpServer()).get(`/children/${child.id}/results`).expect(401);
    await request(app.getHttpServer())
      .get(`/children/${child.id}/results`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .expect(403);

    // No results computed yet for this child — 404, but crucially past both guards (not
    // 401/403), proving the owner's own token was accepted.
    await request(app.getHttpServer())
      .get(`/children/${child.id}/results`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(404);
  });
});
