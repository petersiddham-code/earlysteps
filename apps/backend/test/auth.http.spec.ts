/**
 * HTTP-level test for the auth routes (issue #94 QA follow-up on PR #96): a caller found
 * `POST /auth/login` returning Nest's default 201 Created instead of 200 OK. Service-level
 * tests (auth.integration.spec.ts) call AuthService directly and can't see HTTP status codes
 * at all — @HttpCode only takes effect through Nest's actual HTTP execution path — so this
 * boots a real (in-memory-backed) Nest HTTP app and asserts status codes over supertest.
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

async function buildApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      PassportModule,
      // Same config source as production AuthModule (jwt-config.ts) — a mismatched
      // test-only secret here previously masked JwtStrategy independently re-reading
      // process.env instead of sharing config with JwtModule.register().
      JwtModule.register({
        secret: getJwtSecret(),
        signOptions: { expiresIn: getJwtExpiresIn() },
      }),
    ],
    controllers: [AuthController],
    providers: [
      AuthService,
      JwtStrategy,
      { provide: AUTH_REPOSITORY, useClass: InMemoryAuthRepository },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

describe('auth routes — HTTP status codes', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('register responds 201 Created', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'parent1', password: 'correct-horse-battery' })
      .expect(201);
  });

  it('login responds 200 OK, not the Nest-default 201 for POST', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'parent1', password: 'correct-horse-battery' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'parent1', password: 'correct-horse-battery' })
      .expect(200);
    expect(res.body.user.username).toBe('parent1');
  });

  it('me responds 401 with no token and 200 with a valid one', async () => {
    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'parent1', password: 'correct-horse-battery' })
      .expect(201);

    await request(app.getHttpServer()).get('/auth/me').expect(401);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${registered.body.access_token}`)
      .expect(200);
  });

  it('upgrade responds 401 with no token and flips tier to premium with a valid one', async () => {
    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ username: 'parent1', password: 'correct-horse-battery' })
      .expect(201);
    expect(registered.body.user.tier).toBe('free');

    await request(app.getHttpServer()).patch('/auth/upgrade').expect(401);

    const upgraded = await request(app.getHttpServer())
      .patch('/auth/upgrade')
      .set('Authorization', `Bearer ${registered.body.access_token}`)
      .expect(200);
    expect(upgraded.body.tier).toBe('premium');
  });
});
