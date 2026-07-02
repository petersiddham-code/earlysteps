import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { IntakeResponse } from '@earlysteps/shared-types';
import { dedupeLatestByQuestion, recompute } from '@earlysteps/scoring-engine';
import {
  SCREENING_REPOSITORY,
  type ScreeningRepository,
} from './screening.repository.js';
import { toResultsView, type ResultsView } from './results-view.js';
import {
  FAMILIES_REPOSITORY,
  type FamiliesRepository,
} from '../families/families.repository.js';

@Injectable()
export class ScreeningService {
  constructor(
    @Inject(SCREENING_REPOSITORY) private readonly repository: ScreeningRepository,
    @Inject(FAMILIES_REPOSITORY) private readonly familiesRepository: FamiliesRepository,
  ) {}

  /**
   * Persists the new answers, then recomputes against the child's FULL answer history (not
   * just this batch) — recompute() is stateless and has no memory of prior calls, so scoring
   * must always see everything answered so far. Recompute is never partial.
   *
   * Requires data_storage consent (CLAUDE.md §2 rule 9, product plan §4.7) before persisting
   * anything — fail-safe: no recorded grant means no write. The other three consent scopes
   * (ai_analysis, media_capture, professional_sharing) aren't enforced here since no feature
   * that needs them exists yet (no LLM calls, no media capture, no report sharing).
   */
  async submitIntakeResponses(
    childId: string,
    newResponses: IntakeResponse[],
  ): Promise<ResultsView> {
    const hasConsent = await this.familiesRepository.hasConsent(childId, 'data_storage');
    if (!hasConsent) {
      throw new ForbiddenException(
        'Saving answers requires data-storage consent for this child. Please grant it first.',
      );
    }

    // The band is derived from birth month/year at read time and changes as the child
    // ages (#25) — snapshot it here so trend history records which band this screening
    // used. Consent passed above, so the child must exist; a vanished row is a real error.
    const child = await this.familiesRepository.getChild(childId);
    if (!child) {
      throw new NotFoundException(`No child found with id ${childId}`);
    }

    await this.repository.saveIntakeResponses(childId, newResponses);
    const allResponses = await this.repository.getIntakeResponses(childId);

    const computedAt = new Date().toISOString();
    const { profile, supportEstimate, redFlags, answeredTotal } = recompute(
      allResponses,
      { computedAt },
    );

    await this.repository.saveComputedSnapshot(childId, {
      ageBand: child.age_band,
      profile,
      supportEstimate,
      redFlags,
    });

    return toResultsView(profile, supportEstimate, redFlags, answeredTotal);
  }

  async getResults(childId: string): Promise<ResultsView> {
    const snapshot = await this.repository.getLatestSnapshot(childId);
    if (!snapshot) {
      throw new NotFoundException(`No computed results yet for child ${childId}`);
    }
    // Provenance (issue #22): "Based on N answers" counts the caregiver's current answers
    // (latest per question) — recomputed from the raw history because snapshots don't
    // store it. Responses only ever change via submitIntakeResponses, which always
    // snapshots afterwards, so this count and the latest snapshot stay in step.
    const responses = await this.repository.getIntakeResponses(childId);
    return toResultsView(
      snapshot.profile,
      snapshot.supportEstimate,
      snapshot.redFlags,
      dedupeLatestByQuestion(responses).length,
    );
  }

  getIntakeResponses(childId: string): Promise<IntakeResponse[]> {
    return this.repository.getIntakeResponses(childId);
  }
}
