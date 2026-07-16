import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module.js';
import { FamiliesModule } from './families/families.module.js';
import { ScreeningModule } from './screening/screening.module.js';
import { AnalysisModule } from './analysis/analysis.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AdminModule } from './admin/admin.module.js';
import { MediaModule } from './media/media.module.js';

@Module({
  imports: [
    // Cron registry for MediaService's daily retention sweep (issue #134).
    ScheduleModule.forRoot(),
    PrismaModule,
    FamiliesModule,
    ScreeningModule,
    AnalysisModule,
    AuthModule,
    AdminModule,
    MediaModule,
  ],
})
export class AppModule {}
