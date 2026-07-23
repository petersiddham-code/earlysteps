/**
 * HTTP-level test for issue #76: AnalysisController's three routes (response-analysis,
 * follow-up-suggestions, and its answer endpoint) must require a logged-in Premium account,
 * not just ai_analysis consent on the child. Service-level tests (analysis.integration.spec.ts)
 * call AnalysisService directly and never go through the guards at all — this boots a real
 * Nest HTTP app (mirroring auth.http.spec.ts) so JwtAuthGuard + PremiumTierGuard actually run.
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
import { AnalysisController } from '../src/analysis/analysis.controller.js';
import { AnalysisService } from '../src/analysis/analysis.service.js';
import { ANALYSIS_REPOSITORY } from '../src/analysis/analysis.repository.js';
import { RESPONSE_ANALYSIS_CLIENT } from '../src/analysis/analysis-client.js';
import { AI_RESULTS_SUMMARY_CLIENT } from '../src/analysis/ai-summary-client.js';
import { InMemoryAnalysisRepository } from '../src/analysis/testing/in-memory-analysis.repository.js';
import { ScreeningService } from '../src/screening/screening.service.js';
import { SCREENING_REPOSITORY } from '../src/screening/screening.repository.js';
import { InMemoryScreeningRepository } from '../src/screening/testing/in-memory-screening.repository.js';
import { FAMILIES_REPOSITORY } from '../src/families/families.repository.js';
import { InMemoryFamiliesRepository } from '../src/families/testing/in-memory-families.repository.js';
import { MediaService } from '../src/media/media.service.js';
import { MediaEncryptionService } from '../src/media/media-encryption.service.js';
import { MEDIA_REPOSITORY } from '../src/media/media.repository.js';
import { InMemoryMediaRepository } from '../src/media/testing/in-memory-media.repository.js';
import { OBJECT_STORAGE_SERVICE } from '../src/media/object-storage/object-storage.js';
import { InMemoryObjectStorageService } from '../src/media/testing/in-memory-object-storage.service.js';
import { FRAME_EXTRACTION_SERVICE } from '../src/media/frame-extraction.js';
import { FakeFrameExtractionService } from '../src/media/testing/fake-frame-extraction.service.js';
import { AUDIO_TRANSCRIPTION_SERVICE } from '../src/media/audio-transcription.js';
import { FakeAudioTranscriptionService } from '../src/media/testing/fake-audio-transcription.service.js';

async function buildApp(): Promise<{
  app: INestApplication;
  familiesRepository: InMemoryFamiliesRepository;
}> {
  const screeningRepository = new InMemoryScreeningRepository();
  const analysisRepository = new InMemoryAnalysisRepository(screeningRepository);
  const familiesRepository = new InMemoryFamiliesRepository();

  const moduleRef = await Test.createTestingModule({
    imports: [
      PassportModule,
      JwtModule.register({
        secret: getJwtSecret(),
        signOptions: { expiresIn: getJwtExpiresIn() },
      }),
    ],
    controllers: [AuthController, AnalysisController],
    providers: [
      AuthService,
      JwtStrategy,
      { provide: AUTH_REPOSITORY, useClass: InMemoryAuthRepository },
      ScreeningService,
      AnalysisService,
      { provide: SCREENING_REPOSITORY, useValue: screeningRepository },
      { provide: ANALYSIS_REPOSITORY, useValue: analysisRepository },
      { provide: FAMILIES_REPOSITORY, useValue: familiesRepository },
      // No LLM double needed: every case here is rejected by a guard before the
      // service (and therefore this client) is ever reached.
      {
        provide: RESPONSE_ANALYSIS_CLIENT,
        useValue: { analyzeFreeText: async () => null },
      },
      {
        provide: AI_RESULTS_SUMMARY_CLIENT,
        useValue: { generateSummary: async () => null },
      },
      // issue #135/#139/#140: AnalysisService now depends on MediaService for photo/
      // video-frame/audio-transcript evidence; every case here is rejected by a guard
      // before it's ever reached.
      MediaService,
      MediaEncryptionService,
      { provide: MEDIA_REPOSITORY, useClass: InMemoryMediaRepository },
      { provide: OBJECT_STORAGE_SERVICE, useClass: InMemoryObjectStorageService },
      { provide: FRAME_EXTRACTION_SERVICE, useClass: FakeFrameExtractionService },
      { provide: AUDIO_TRANSCRIPTION_SERVICE, useClass: FakeAudioTranscriptionService },
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

describe('AnalysisController — premium-tier HTTP enforcement (issue #76)', () => {
  let app: INestApplication;
  let familiesRepository: InMemoryFamiliesRepository;

  beforeEach(async () => {
    ({ app, familiesRepository } = await buildApp());
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects every route with 401 when no token is sent', async () => {
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'ai_analysis',
    ]);

    await request(app.getHttpServer())
      .post(`/children/${child.id}/response-analysis`)
      .expect(401);
    await request(app.getHttpServer())
      .get(`/children/${child.id}/follow-up-suggestions`)
      .expect(401);
    await request(app.getHttpServer())
      .post(`/children/${child.id}/follow-up-suggestions/some-id/answer`)
      .send({ answer: 'yes' })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/children/${child.id}/results-summary`)
      .expect(401);
  });

  it('rejects a logged-in free-tier account with 403, even with ai_analysis consent granted', async () => {
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'ai_analysis',
    ]);
    const token = await registerAndGetToken(app, 'free-parent');

    await request(app.getHttpServer())
      .post(`/children/${child.id}/response-analysis`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    await request(app.getHttpServer())
      .get(`/children/${child.id}/follow-up-suggestions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/children/${child.id}/results-summary`)
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('allows a Premium account through to the service', async () => {
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'ai_analysis',
    ]);
    const token = await registerAndGetToken(app, 'premium-parent');
    await request(app.getHttpServer())
      .patch('/auth/upgrade')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // No free-text answers were ever submitted for this child, so the service returns an
    // empty list — the point here is the guard let the request through at all (200, not
    // 401/403), not the analysis content.
    const res = await request(app.getHttpServer())
      .post(`/children/${child.id}/response-analysis`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect(res.body).toEqual([]);

    await request(app.getHttpServer())
      .get(`/children/${child.id}/follow-up-suggestions`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // No answers were ever submitted for this child, so the service returns null — the
    // point here is the guard let the request through at all (201, not 401/403).
    await request(app.getHttpServer())
      .post(`/children/${child.id}/results-summary`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
  });
});
