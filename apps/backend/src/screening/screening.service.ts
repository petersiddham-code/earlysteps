import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IntakeResponse } from '@earlysteps/shared-types';
import { recompute } from '@earlysteps/scoring-engine';
import {
  SCREENING_REPOSITORY,
  type ScreeningRepository,
} from './screening.repository.js';
import { toResultsView, type ResultsView } from './results-view.js';

@Injectable()
export class ScreeningService {
  constructor(
    @Inject(SCREENING_REPOSITORY) private readonly repository: ScreeningRepository,
  ) {}

  /**
   * Persists the new answers, then recomputes against the child's FULL answer history (not
   * just this batch) — recompute() is stateless and has no memory of prior calls, so scoring
   * must always see everything answered so far. Recompute is never partial.
   */
  async submitIntakeResponses(
    childId: string,
    newResponses: IntakeResponse[],
  ): Promise<ResultsView> {
    await this.repository.saveIntakeResponses(childId, newResponses);
    const allResponses = await this.repository.getIntakeResponses(childId);

    const computedAt = new Date().toISOString();
    const { profile, supportEstimate, redFlags } = recompute(allResponses, {
      computedAt,
    });

    await this.repository.saveComputedSnapshot(childId, {
      profile,
      supportEstimate,
      redFlags,
    });

    return toResultsView(profile, supportEstimate, redFlags);
  }

  async getResults(childId: string): Promise<ResultsView> {
    const snapshot = await this.repository.getLatestSnapshot(childId);
    if (!snapshot) {
      throw new NotFoundException(`No computed results yet for child ${childId}`);
    }
    return toResultsView(snapshot.profile, snapshot.supportEstimate, snapshot.redFlags);
  }
}
