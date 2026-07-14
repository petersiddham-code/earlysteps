import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { FamiliesModule } from './families/families.module.js';
import { ScreeningModule } from './screening/screening.module.js';
import { AnalysisModule } from './analysis/analysis.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AdminModule } from './admin/admin.module.js';

@Module({
  imports: [
    PrismaModule,
    FamiliesModule,
    ScreeningModule,
    AnalysisModule,
    AuthModule,
    AdminModule,
  ],
})
export class AppModule {}
