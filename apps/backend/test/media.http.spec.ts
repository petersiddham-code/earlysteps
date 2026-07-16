/**
 * HTTP-level test for issue #134's media endpoints: like the AI endpoints (issue #76),
 * media capture must require a logged-in Premium account at the HTTP boundary — the
 * mobile app's tier gating (issue #123 disabled the consent toggle for free accounts)
 * is not enforcement. Service-level behaviour (encryption, retention, consent internals)
 * is covered in media.integration.spec.ts; this boots a real Nest HTTP app (mirroring
 * analysis.http.spec.ts) so JwtAuthGuard + PremiumTierGuard + FamilyOwnershipGuard and
 * the multipart pipeline actually run.
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
import { FAMILIES_REPOSITORY } from '../src/families/families.repository.js';
import { InMemoryFamiliesRepository } from '../src/families/testing/in-memory-families.repository.js';
import { MediaController } from '../src/media/media.controller.js';
import { MediaService } from '../src/media/media.service.js';
import { MEDIA_REPOSITORY } from '../src/media/media.repository.js';
import { MediaEncryptionService } from '../src/media/media-encryption.service.js';
import { OBJECT_STORAGE_SERVICE } from '../src/media/object-storage/object-storage.js';
import { InMemoryMediaRepository } from '../src/media/testing/in-memory-media.repository.js';
import { InMemoryObjectStorageService } from '../src/media/testing/in-memory-object-storage.service.js';
import { FRAME_EXTRACTION_SERVICE } from '../src/media/frame-extraction.js';
import { FakeFrameExtractionService } from '../src/media/testing/fake-frame-extraction.service.js';

async function buildApp(): Promise<{
  app: INestApplication;
  familiesRepository: InMemoryFamiliesRepository;
  storage: InMemoryObjectStorageService;
}> {
  const familiesRepository = new InMemoryFamiliesRepository();
  const storage = new InMemoryObjectStorageService();
  const moduleRef = await Test.createTestingModule({
    imports: [
      PassportModule,
      JwtModule.register({
        secret: getJwtSecret(),
        signOptions: { expiresIn: getJwtExpiresIn() },
      }),
    ],
    controllers: [AuthController, MediaController],
    providers: [
      AuthService,
      JwtStrategy,
      { provide: AUTH_REPOSITORY, useClass: InMemoryAuthRepository },
      MediaService,
      MediaEncryptionService,
      { provide: MEDIA_REPOSITORY, useValue: new InMemoryMediaRepository() },
      { provide: FAMILIES_REPOSITORY, useValue: familiesRepository },
      { provide: OBJECT_STORAGE_SERVICE, useValue: storage },
      { provide: FRAME_EXTRACTION_SERVICE, useClass: FakeFrameExtractionService },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return { app, familiesRepository, storage };
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

async function upgradeToPremium(app: INestApplication, token: string): Promise<void> {
  await request(app.getHttpServer())
    .patch('/auth/upgrade')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
}

describe('MediaController — auth/tier/consent HTTP enforcement (issue #134)', () => {
  let app: INestApplication;
  let familiesRepository: InMemoryFamiliesRepository;
  let storage: InMemoryObjectStorageService;

  beforeEach(async () => {
    ({ app, familiesRepository, storage } = await buildApp());
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects every route with 401 when no token is sent', async () => {
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'media_capture',
    ]);
    await request(app.getHttpServer())
      .post(`/children/${child.id}/media`)
      .attach('file', Buffer.from('bytes'), 'photo.jpg')
      .field('kind', 'photo')
      .expect(401);
    await request(app.getHttpServer()).get(`/children/${child.id}/media`).expect(401);
    await request(app.getHttpServer())
      .delete(`/children/${child.id}/media/some-id`)
      .expect(401);
    expect(storage.blobs.size).toBe(0);
  });

  it('rejects a logged-in free-tier account with 403, even with media_capture consent granted', async () => {
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'media_capture',
    ]);
    const token = await registerAndGetToken(app, 'free-parent');

    await request(app.getHttpServer())
      .post(`/children/${child.id}/media`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('bytes'), 'photo.jpg')
      .field('kind', 'photo')
      .expect(403);
    await request(app.getHttpServer())
      .get(`/children/${child.id}/media`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(storage.blobs.size).toBe(0);
  });

  it('rejects a Premium upload with 403 when media_capture consent is off — nothing stored', async () => {
    const { child } = await familiesRepository.seedChildWithConsent(['data_storage']);
    const token = await registerAndGetToken(app, 'premium-no-consent');
    await upgradeToPremium(app, token);

    await request(app.getHttpServer())
      .post(`/children/${child.id}/media`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('bytes'), 'photo.jpg')
      .field('kind', 'photo')
      .expect(403);
    expect(storage.blobs.size).toBe(0);
  });

  it('accepts a Premium multipart upload with consent, then lists and deletes it', async () => {
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'media_capture',
    ]);
    const token = await registerAndGetToken(app, 'premium-parent');
    await upgradeToPremium(app, token);

    const uploaded = await request(app.getHttpServer())
      .post(`/children/${child.id}/media`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('pretend-jpeg-bytes'), 'photo.jpg')
      .field('kind', 'photo')
      .expect(201);
    expect(uploaded.body.kind).toBe('photo');
    // The API returns caregiver-facing metadata only — never the blob, the family key, or
    // server-internal fields (storageKey, consentId; security review, issue #134).
    expect(uploaded.body.storageKey).toBeUndefined();
    expect(uploaded.body.consentId).toBeUndefined();
    expect(storage.blobs.size).toBe(1);

    const listed = await request(app.getHttpServer())
      .get(`/children/${child.id}/media`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(listed.body).toHaveLength(1);

    await request(app.getHttpServer())
      .delete(`/children/${child.id}/media/${uploaded.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(204);
    expect(storage.blobs.size).toBe(0);
  });

  it('rejects an upload with an unknown kind (400), storing nothing', async () => {
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'media_capture',
    ]);
    const token = await registerAndGetToken(app, 'premium-bad-kind');
    await upgradeToPremium(app, token);

    await request(app.getHttpServer())
      .post(`/children/${child.id}/media`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('bytes'), 'file.bin')
      .field('kind', 'document')
      .expect(400);
    expect(storage.blobs.size).toBe(0);
  });

  it('rejects an upload with no file attached (400)', async () => {
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'media_capture',
    ]);
    const token = await registerAndGetToken(app, 'premium-no-file');
    await upgradeToPremium(app, token);

    await request(app.getHttpServer())
      .post(`/children/${child.id}/media`)
      .set('Authorization', `Bearer ${token}`)
      .field('kind', 'photo')
      .expect(400);
    expect(storage.blobs.size).toBe(0);
  });
});
