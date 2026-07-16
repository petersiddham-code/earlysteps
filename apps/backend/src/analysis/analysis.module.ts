import { Logger, Module } from '@nestjs/common';
import { AnalysisController } from './analysis.controller.js';
import { AnalysisService } from './analysis.service.js';
import { ANALYSIS_REPOSITORY } from './analysis.repository.js';
import { PrismaAnalysisRepository } from './prisma-analysis.repository.js';
import {
  DisabledResponseAnalysisClient,
  RESPONSE_ANALYSIS_CLIENT,
} from './analysis-client.js';
import { ClaudeResponseAnalysisClient } from './claude-analysis.client.js';
import {
  AI_RESULTS_SUMMARY_CLIENT,
  DisabledAiResultsSummaryClient,
} from './ai-summary-client.js';
import { ClaudeAiResultsSummaryClient } from './claude-ai-summary.client.js';
import { FamiliesModule } from '../families/families.module.js';
import { ScreeningModule } from '../screening/screening.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { MediaModule } from '../media/media.module.js';

@Module({
  // AuthModule registers the 'jwt' passport strategy that AnalysisController's
  // JwtAuthGuard (issue #76) depends on — imported explicitly so this module still
  // resolves correctly if it's ever bootstrapped on its own (e.g. in a test). MediaModule
  // (issue #135) supplies MediaService for Assessment B's photo evidence.
  imports: [FamiliesModule, ScreeningModule, AuthModule, MediaModule],
  controllers: [AnalysisController],
  providers: [
    AnalysisService,
    { provide: ANALYSIS_REPOSITORY, useClass: PrismaAnalysisRepository },
    {
      // Without an API key the stage is wired as disabled: no LLM call is ever made
      // and every analysis run contributes nothing (offline-first, issue #26).
      provide: RESPONSE_ANALYSIS_CLIENT,
      useFactory: () => {
        if (process.env.ANTHROPIC_API_KEY) return new ClaudeResponseAnalysisClient();
        new Logger('AnalysisModule').log(
          'ANTHROPIC_API_KEY not set — free-text response analysis is disabled',
        );
        return new DisabledResponseAnalysisClient();
      },
    },
    {
      // Same offline-first wiring as RESPONSE_ANALYSIS_CLIENT above (issue #104).
      provide: AI_RESULTS_SUMMARY_CLIENT,
      useFactory: () => {
        if (process.env.ANTHROPIC_API_KEY) return new ClaudeAiResultsSummaryClient();
        new Logger('AnalysisModule').log(
          'ANTHROPIC_API_KEY not set — AI results summary is disabled',
        );
        return new DisabledAiResultsSummaryClient();
      },
    },
  ],
})
export class AnalysisModule {}
