import { Module } from '@nestjs/common';
import { ScreeningController } from './screening.controller.js';
import { ScreeningService } from './screening.service.js';
import { PrismaScreeningRepository } from './prisma-screening.repository.js';
import { SCREENING_REPOSITORY } from './screening.repository.js';

@Module({
  controllers: [ScreeningController],
  providers: [
    ScreeningService,
    { provide: SCREENING_REPOSITORY, useClass: PrismaScreeningRepository },
  ],
})
export class ScreeningModule {}
