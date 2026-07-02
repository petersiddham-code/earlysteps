import { Module } from '@nestjs/common';
import { ScreeningController } from './screening.controller.js';
import { ScreeningService } from './screening.service.js';
import { PrismaScreeningRepository } from './prisma-screening.repository.js';
import { SCREENING_REPOSITORY } from './screening.repository.js';
import { FamiliesModule } from '../families/families.module.js';

@Module({
  imports: [FamiliesModule],
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
