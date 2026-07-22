import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
    // Global rate-limit default, now that this backend is reachable from the public
    // internet (named tunnel, earlypathlabs.com). Per-route @Throttle() overrides on
    // auth (brute-force) and the AI-analysis endpoints (real Claude API cost per call)
    // set tighter limits — see auth.controller.ts and analysis.controller.ts.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    FamiliesModule,
    ScreeningModule,
    AnalysisModule,
    AuthModule,
    AdminModule,
    MediaModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
