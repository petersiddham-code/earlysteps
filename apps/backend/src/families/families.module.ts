import { Module } from '@nestjs/common';
import { FamiliesController } from './families.controller.js';
import { FamiliesService } from './families.service.js';
import { PrismaFamiliesRepository } from './prisma-families.repository.js';
import { FAMILIES_REPOSITORY } from './families.repository.js';

@Module({
  controllers: [FamiliesController],
  providers: [
    FamiliesService,
    { provide: FAMILIES_REPOSITORY, useClass: PrismaFamiliesRepository },
  ],
  // ScreeningModule needs the repository token directly to check data_storage consent.
  exports: [FAMILIES_REPOSITORY],
})
export class FamiliesModule {}
