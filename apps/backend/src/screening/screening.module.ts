import { Module } from '@nestjs/common';
import { ScreeningController } from './screening.controller.js';
import { ScreeningService } from './screening.service.js';
import { PrismaScreeningRepository } from './prisma-screening.repository.js';
import { SCREENING_REPOSITORY } from './screening.repository.js';
import { FamiliesModule } from '../families/families.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  // AuthModule registers the 'jwt' passport strategy that ScreeningController's
  // OptionalJwtAuthGuard depends on (issue #23) — imported explicitly so this module
  // still resolves correctly if it's ever bootstrapped on its own (e.g. in a test).
  imports: [FamiliesModule, AuthModule],
  controllers: [ScreeningController],
  providers: [
    ScreeningService,
    { provide: SCREENING_REPOSITORY, useClass: PrismaScreeningRepository },
  ],
  // AnalysisModule routes confirmed follow-up answers through the same pipeline as
  // any other intake response — the deterministic engine stays the single entry point.
  exports: [ScreeningService],
})
export class ScreeningModule {}
