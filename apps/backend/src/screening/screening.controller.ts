import { Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import type { IntakeResponse } from '@earlysteps/shared-types';
import { ScreeningService } from './screening.service.js';
import { SubmitIntakeResponsesDto } from './dto/submit-intake-responses.dto.js';
import type { ResultsView } from './results-view.js';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard.js';
import { FamilyOwnershipGuard } from '../families/family-ownership.guard.js';

/**
 * Issue #23: same optional-auth + ownership pattern as FamiliesController — a child under
 * an unowned/guest family stays fully open (no regression), a child under an
 * account-linked family only answers to that account's JWT.
 */
@UseGuards(OptionalJwtAuthGuard, FamilyOwnershipGuard)
@Controller('children/:childId')
export class ScreeningController {
  constructor(
    // Explicit token: vitest's esbuild transform emits no decorator design:paramtypes
    // metadata, so class-typed constructor injection resolves to undefined in tests.
    @Inject(ScreeningService) private readonly screeningService: ScreeningService,
  ) {}

  @Post('intake-responses')
  submitIntakeResponses(
    @Param('childId') childId: string,
    @Body() dto: SubmitIntakeResponsesDto,
  ): Promise<ResultsView> {
    const responses: IntakeResponse[] = dto.responses.map((r) => ({
      ...r,
      domain: r.domain as IntakeResponse['domain'],
      child_id: childId,
    }));
    return this.screeningService.submitIntakeResponses(childId, responses);
  }

  @Get('results')
  getResults(@Param('childId') childId: string): Promise<ResultsView> {
    return this.screeningService.getResults(childId);
  }

  /**
   * Raw answer history — lets a client reconstruct caregiver-authored content (e.g. the
   * strengths/interests answers) without re-deriving it server-side. Read-only; scoring
   * itself only ever happens via submitIntakeResponses.
   */
  @Get('intake-responses')
  getIntakeResponses(@Param('childId') childId: string): Promise<IntakeResponse[]> {
    return this.screeningService.getIntakeResponses(childId);
  }
}
