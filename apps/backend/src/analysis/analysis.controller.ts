import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { FollowUpSuggestion } from '@earlysteps/shared-types';
import { AnalysisService } from './analysis.service.js';
import { AnswerFollowUpDto } from './dto/answer-follow-up.dto.js';
import type { ResultsView } from '../screening/results-view.js';

/**
 * Free-text response-analysis endpoints (issue #26). All three are additive to the
 * screening pipeline: results render fine if none of them is ever called.
 */
@Controller('children/:childId')
export class AnalysisController {
  constructor(private readonly analysisService: AnalysisService) {}

  /**
   * Analyzes any not-yet-processed free-text answers (403 without ai_analysis
   * consent) and returns all pending confirmation follow-ups. Clients call this
   * best-effort after showing results — a failure here never blocks results.
   */
  @Post('response-analysis')
  runAnalysis(@Param('childId') childId: string): Promise<FollowUpSuggestion[]> {
    return this.analysisService.runAnalysis(childId);
  }

  /** Pending confirmation follow-ups (403 without ai_analysis consent). */
  @Get('follow-up-suggestions')
  getPendingSuggestions(
    @Param('childId') childId: string,
  ): Promise<FollowUpSuggestion[]> {
    return this.analysisService.getPendingSuggestions(childId);
  }

  /**
   * Records the caregiver's answer as a normal IntakeResponse (data_storage consent
   * enforced by the screening pipeline) and returns the recomputed results view.
   */
  @Post('follow-up-suggestions/:suggestionId/answer')
  answerSuggestion(
    @Param('childId') childId: string,
    @Param('suggestionId') suggestionId: string,
    @Body() dto: AnswerFollowUpDto,
  ): Promise<ResultsView> {
    return this.analysisService.answerSuggestion(childId, suggestionId, dto.answer);
  }
}
