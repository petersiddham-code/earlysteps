import { Module } from '@nestjs/common';
import { FamiliesController } from './families.controller.js';
import { FamiliesService } from './families.service.js';
import { PrismaFamiliesRepository } from './prisma-families.repository.js';
import { FAMILIES_REPOSITORY } from './families.repository.js';
import { FamilyOwnershipGuard } from './family-ownership.guard.js';
import { AuthModule } from '../auth/auth.module.js';
import { ObjectStorageModule } from '../media/object-storage/object-storage.module.js';

@Module({
  // AuthModule registers the 'jwt' passport strategy that FamiliesController's
  // OptionalJwtAuthGuard depends on — imported explicitly so this module still resolves
  // correctly if it's ever bootstrapped on its own (e.g. in a test), same convention as
  // AnalysisModule. ObjectStorageModule (issue #134) is standalone (no dependency back on
  // this module) so right-to-erasure can purge media blobs without a Families <-> Media
  // cycle — see FamiliesService.deleteFamily.
  imports: [AuthModule, ObjectStorageModule],
  controllers: [FamiliesController],
  providers: [
    FamiliesService,
    { provide: FAMILIES_REPOSITORY, useClass: PrismaFamiliesRepository },
    FamilyOwnershipGuard,
  ],
  // ScreeningModule/AnalysisModule need the repository token directly (consent checks,
  // ownership checks) and FamilyOwnershipGuard itself (issue #23) to gate their own routes.
  exports: [FAMILIES_REPOSITORY, FamilyOwnershipGuard],
})
export class FamiliesModule {}
