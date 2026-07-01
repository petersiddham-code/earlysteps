import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { IntakeResponse } from '@earlysteps/shared-types';
import { ScreeningService } from './screening.service.js';
import { SubmitIntakeResponsesDto } from './dto/submit-intake-responses.dto.js';
import type { ResultsView } from './results-view.js';

@Controller('children/:childId')
export class ScreeningController {
  constructor(private readonly screeningService: ScreeningService) {}

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
}
