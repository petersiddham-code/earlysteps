import { Module } from '@nestjs/common';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';
import { MediaEncryptionService } from './media-encryption.service.js';
import { MEDIA_REPOSITORY } from './media.repository.js';
import { PrismaMediaRepository } from './prisma-media.repository.js';
import { ObjectStorageModule } from './object-storage/object-storage.module.js';
import { FamiliesModule } from '../families/families.module.js';
import { AuthModule } from '../auth/auth.module.js';

/**
 * Media capture, Phase 1 (issue #134): consent-enforced upload, per-family-encrypted
 * blob storage, and the 90-day retention sweep. FamiliesModule provides the consent
 * check + ownership guard; ObjectStorageModule is standalone so FamiliesModule can also
 * use the blob store for right-to-erasure without a module cycle. AuthModule registers
 * the 'jwt' passport strategy MediaController's JwtAuthGuard depends on — imported
 * explicitly, same convention as AnalysisModule.
 */
@Module({
  imports: [FamiliesModule, ObjectStorageModule, AuthModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    MediaEncryptionService,
    { provide: MEDIA_REPOSITORY, useClass: PrismaMediaRepository },
  ],
})
export class MediaModule {}
