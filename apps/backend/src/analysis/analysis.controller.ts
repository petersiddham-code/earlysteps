import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type {
  AiResultsSummary,
  ComparisonResult,
  FollowUpSuggestion,
} from '@earlysteps/shared-types';
import { AnalysisService } from './analysis.service.js';
import { AnswerFollowUpDto } from './dto/answer-follow-up.dto.js';
import type { ResultsView } from '../screening/results-view.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PremiumTierGuard } from '../auth/premium-tier.guard.js';
import { FamilyOwnershipGuard } from '../families/family-ownership.guard.js';

/**
 * Free-text response-analysis endpoints (issue #26). All three are additive to the
 * screening pipeline: results render fine if none of them is ever called.
 *
 * Issue #76: gated behind login + Premium tier at the HTTP boundary, not just the
 * mobile app's canUseAiFeatures() check (issue #99) — closes the gap where a direct API
 * call from a free or guest account could still reach the LLM stage as long as
 * ai_analysis consent was set (docs/clinical-review/content-gaps.md §6(c)).
 *
 * Issue #23: FamilyOwnershipGuard added alongside — a Premium account can't reach a
 * child under a DIFFERENT account's family (403). A child whose family predates the
 * ownership link (userId null) stays as open to any Premium account as it is today.
 */
@UseGuards(JwtAuthGuard, PremiumTierGuard, FamilyOwnershipGuard)
@Controller('children/:childId')
export class AnalysisController {
  constructor(
    // Explicit token: vitest's esbuild transform emits no decorator design:paramtypes
    // metadata, so class-typed constructor injection resolves to undefined in tests.
    @Inject(AnalysisService) private readonly analysisService: AnalysisService,
  ) {}

  /**
   * Analyzes any not-yet-processed free-text answers (403 without ai_analysis
   * consent) and returns all pending confirmation follow-ups. Clients call this
   * best-effort after showing results — a failure here never blocks results.
   */
  /** Tighter than the app-wide default (app.module.ts) — this triggers a real Claude API
   * call per free-text answer, so an internet-facing backend needs a cost ceiling here. */
  @Post('response-analysis')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
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

  /**
   * Independent AI results summary (issue #104): fired once when the caregiver navigates
   * to Results, not when the collapsible section is expanded — so the narrative is
   * already there (or in flight) by the time they open it. Returns the cached narrative
   * unchanged if the answered questions haven't changed since it was last generated;
   * null (403 aside) means "no section" — a caregiver-visible failure never happens.
   */
  /** Same cost reasoning as response-analysis — cached by content hash, but an attacker
   * varying answers slightly each call can still force repeated real generations. */
  @Post('results-summary')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  getResultsSummary(@Param('childId') childId: string): Promise<AiResultsSummary | null> {
    return this.analysisService.getResultsSummary(childId);
  }

  /**
   * The Comparison Section (CLAUDE.md §13/§14, dual-assessment update 2026-07-11): agreement
   * / partial agreement / disagreement between Assessment A and Assessment B, computed AFTER
   * both have already independently produced their own output. Same gate/fail-closed
   * contract as results-summary — null (403 aside) means "no section".
   */
  @Post('comparison')
  getComparisonResult(
    @Param('childId') childId: string,
  ): Promise<ComparisonResult | null> {
    return this.analysisService.getComparisonResult(childId);
  }
}
