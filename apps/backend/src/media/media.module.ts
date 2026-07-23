import { Logger, Module } from '@nestjs/common';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';
import { MediaEncryptionService } from './media-encryption.service.js';
import { MEDIA_REPOSITORY } from './media.repository.js';
import { PrismaMediaRepository } from './prisma-media.repository.js';
import { ObjectStorageModule } from './object-storage/object-storage.module.js';
import { FamiliesModule } from '../families/families.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { FRAME_EXTRACTION_SERVICE } from './frame-extraction.js';
import { FfmpegFrameExtractionService } from './ffmpeg-frame-extraction.service.js';
import {
  AUDIO_TRANSCRIPTION_SERVICE,
  DisabledAudioTranscriptionService,
} from './audio-transcription.js';
import { OpenAiAudioTranscriptionService } from './openai-audio-transcription.service.js';

/**
 * Media capture, Phase 1 (issue #134): consent-enforced upload, per-family-encrypted
 * blob storage, and the 90-day retention sweep. FamiliesModule provides the consent
 * check + ownership guard; ObjectStorageModule is standalone so FamiliesModule can also
 * use the blob store for right-to-erasure without a module cycle. AuthModule registers
 * the 'jwt' passport strategy MediaController's JwtAuthGuard depends on — imported
 * explicitly, same convention as AnalysisModule.
 *
 * Exports MediaService so AnalysisModule can pull decrypted photo/video-frame/audio-
 * transcript evidence into Assessment B (issue #135 Phase 2, issue #139 Phase 3, issue #140
 * Phase 4) without duplicating the storage/encryption/consent wiring above.
 */
@Module({
  imports: [FamiliesModule, ObjectStorageModule, AuthModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    MediaEncryptionService,
    { provide: MEDIA_REPOSITORY, useClass: PrismaMediaRepository },
    { provide: FRAME_EXTRACTION_SERVICE, useClass: FfmpegFrameExtractionService },
    {
      // Without an API key the stage is wired as disabled: no cloud STT call is ever made
      // and audio simply contributes no evidence (offline-first, same precedent as
      // AnalysisModule's ANTHROPIC_API_KEY-gated clients).
      provide: AUDIO_TRANSCRIPTION_SERVICE,
      useFactory: () => {
        if (process.env.OPENAI_API_KEY) return new OpenAiAudioTranscriptionService();
        new Logger('MediaModule').log(
          'OPENAI_API_KEY not set — audio transcription is disabled',
        );
        return new DisabledAudioTranscriptionService();
      },
    },
  ],
  exports: [MediaService],
})
export class MediaModule {}
