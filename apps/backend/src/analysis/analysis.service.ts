/**
 * Free-text response-analysis stage (issue #26, product plan §9.2).
 *
 * Deterministic-first, LLM-assists design (CLAUDE.md §2 rule 7):
 *  - The scoring pipeline (ScreeningService.submitIntakeResponses) runs exactly as
 *    before and NEVER waits on, or reads from, anything here. This stage is additive.
 *  - The LLM only ever proposes candidate signals from a caregiver's typed text. A
 *    recognized red-flag signal becomes a content-authored confirmation follow-up
 *    question; only the caregiver's own structured answer — a normal IntakeResponse —
 *    reaches the deterministic engine/red-flag rules. LLM proposes; caregiver
 *    confirms; rules decide.
 *  - Everything is gated on the ai_analysis consent scope (product plan §4.7):
 *    without it, no LLM call is ever made and results still work.
 *  - PII minimization (CLAUDE.md §8): each call carries only the question text and
 *    the single typed answer. No nickname, no profile, no other answers.
 *  - Fail closed (CLAUDE.md §8): a malformed or missing model response contributes
 *    nothing — no throw, no suggestion, no effect on results.
 *
 * Scope note: only signals carrying a recognized red_flag_type generate follow-ups.
 * Domain-only signals are accepted by the schema but currently dropped — mapping them
 * into weighted scoring needs clinically-authored questions/weights first (see
 * docs/clinical-review/content-gaps.md and issue #22 coordination).
 */
import { createHash } from 'node:crypto';
import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  isFreeTextAnswer,
  stripFreeTextPrefix,
  type AiResultsSummary,
  type ComparisonResult,
  type EvidenceModality,
  type FollowUpAnswer,
  type FollowUpSuggestion,
  type IntakeResponse,
} from '@earlysteps/shared-types';
import { compareAssessments } from '@earlysteps/comparison-engine';
import {
  FOLLOW_UPS_BY_RED_FLAG_TYPE,
  allQuestions,
  getFollowUp,
} from '@earlysteps/content';
import { dedupeLatestByQuestion } from '@earlysteps/scoring-engine';
import {
  FAMILIES_REPOSITORY,
  type FamiliesRepository,
} from '../families/families.repository.js';
import { ScreeningService } from '../screening/screening.service.js';
import type { ResultsView } from '../screening/results-view.js';
import { MediaService, type AnalyzablePhoto } from '../media/media.service.js';
import {
  ANALYSIS_REPOSITORY,
  type AnalysisRepository,
  type StoredFollowUpSuggestion,
} from './analysis.repository.js';
import {
  RESPONSE_ANALYSIS_CLIENT,
  type ResponseAnalysisClient,
} from './analysis-client.js';
import {
  AI_RESULTS_SUMMARY_CLIENT,
  type AiResultsSummaryClient,
  type AiSummaryAnsweredQuestion,
  type AiSummaryPhotoEvidence,
} from './ai-summary-client.js';
import { parseAnalysisOutput } from './signal-schema.js';
import { isSummaryStillSafe, parseAiSummaryOutput } from './ai-summary-schema.js';

/** See generateSafeSummary()'s doc comment for why a single rejected generation retries. */
const MAX_SUMMARY_GENERATION_ATTEMPTS = 3;

function freeTextEntries(answer: IntakeResponse['answer']): string[] {
  const entries = Array.isArray(answer)
    ? answer
    : typeof answer === 'string'
      ? [answer]
      : [];
  return entries.filter(isFreeTextAnswer).map(stripFreeTextPrefix);
}

@Injectable()
export class AnalysisService {
  private readonly logger = new Logger(AnalysisService.name);

  constructor(
    @Inject(ANALYSIS_REPOSITORY) private readonly repository: AnalysisRepository,
    @Inject(RESPONSE_ANALYSIS_CLIENT) private readonly client: ResponseAnalysisClient,
    @Inject(AI_RESULTS_SUMMARY_CLIENT)
    private readonly aiSummaryClient: AiResultsSummaryClient,
    @Inject(FAMILIES_REPOSITORY) private readonly familiesRepository: FamiliesRepository,
    // Explicit token: vitest's esbuild transform emits no decorator design:paramtypes
    // metadata, so class-typed constructor injection resolves to undefined in tests.
    @Inject(ScreeningService) private readonly screeningService: ScreeningService,
    // Same explicit-token reasoning (issue #135): pulls decrypted photo evidence for
    // Assessment B without duplicating MediaModule's storage/encryption/consent wiring.
    @Inject(MediaService) private readonly mediaService: MediaService,
  ) {}

  /**
   * Analyzes any not-yet-processed free-text answers and returns ALL pending
   * confirmation follow-ups. Requires ai_analysis consent — without it this method
   * (and therefore any LLM call) never runs; the deterministic results are unaffected.
   */
  async runAnalysis(childId: string): Promise<FollowUpSuggestion[]> {
    await this.ensureAiAnalysisConsent(childId);

    const unanalyzed = await this.repository.getUnanalyzedFreeTextResponses(childId);
    const questionTextById = new Map(allQuestions().map((q) => [q.id, q.text]));

    for (const response of unanalyzed) {
      let processedEveryEntry = true;
      for (const freeText of freeTextEntries(response.answer)) {
        const questionText =
          questionTextById.get(response.question_id) ??
          'An open note from the caregiver.';
        const rawOutput = await this.client.analyzeFreeText({ questionText, freeText });
        if (rawOutput === null) {
          // Unavailable (no key / transport failure): leave unanalyzed for a later
          // retry. Nothing else happens — the stage contributes nothing.
          processedEveryEntry = false;
          continue;
        }
        // Malformed output validates to zero signals (fail closed) but still counts
        // as processed — retrying a text the model choked on isn't a safety gain.
        const signals = parseAnalysisOutput(rawOutput);
        for (const signal of signals) {
          if (signal.red_flag_type === null) continue; // domain-only: no path yet
          const followUp = FOLLOW_UPS_BY_RED_FLAG_TYPE[signal.red_flag_type];
          if (!followUp) continue;
          await this.repository.createSuggestion(childId, {
            followUpId: followUp.id,
            redFlagType: signal.red_flag_type,
            sourceQuestionId: response.question_id,
            // Issue #102: the model's own short, schema-length-capped fragment, not the
            // caregiver's whole typed note — several of these can now render together
            // on one screen, so each needs to stay display-sized.
            sourceQuote: signal.evidence_quote,
            salience: signal.salience,
          });
        }
      }
      if (processedEveryEntry) {
        await this.repository.markResponsesAnalyzed(childId, [response]);
      }
    }

    return this.pendingSuggestionViews(childId);
  }

  /** Pending confirmations for the Results screen. Same ai_analysis gate as the run. */
  async getPendingSuggestions(childId: string): Promise<FollowUpSuggestion[]> {
    await this.ensureAiAnalysisConsent(childId);
    return this.pendingSuggestionViews(childId);
  }

  /**
   * Records the caregiver's structured answer to a follow-up as a NORMAL
   * IntakeResponse through the standard scoring pipeline (data_storage consent
   * enforced there), then marks the suggestion answered. A confirmed 'yes' on
   * FU_<type> triggers the matching deterministic red-flag rule; 'no' / 'not_sure'
   * contribute nothing. Returns the freshly recomputed results view.
   */
  async answerSuggestion(
    childId: string,
    suggestionId: string,
    answer: FollowUpAnswer,
  ): Promise<ResultsView> {
    const suggestion = await this.repository.getSuggestion(childId, suggestionId);
    if (!suggestion || suggestion.status !== 'pending') {
      throw new NotFoundException(
        `No pending follow-up suggestion ${suggestionId} for child ${childId}`,
      );
    }

    const response: IntakeResponse = {
      child_id: childId,
      question_id: suggestion.followUpId,
      domain: 'profile',
      answer,
      timestamp: new Date().toISOString(),
    };
    const view = await this.screeningService.submitIntakeResponses(childId, [response]);
    await this.repository.markSuggestionAnswered(childId, suggestionId);
    return view;
  }

  /**
   * The independent AI results summary (issue #104): a plain-language narrative built
   * purely from the caregiver's raw answers, never the deterministic engine's computed
   * levels/estimate/recommendation/red flags (CLAUDE.md §2 rule 7). Same ai_analysis
   * consent gate as the free-text stage. Cached per child and only regenerated when the
   * answered-question set has actually changed since the last generation — a Results
   * visit with no new answers reuses the cached narrative rather than calling the LLM
   * again. Returns null (section doesn't render) for: no answers yet, no API key,
   * transport failure, or a malformed/unsafe model response (fail closed, CLAUDE.md §8).
   */
  async getResultsSummary(childId: string): Promise<AiResultsSummary | null> {
    await this.ensureAiAnalysisConsent(childId);

    const child = await this.familiesRepository.getChild(childId);
    if (!child) return null;

    const responses = dedupeLatestByQuestion(
      await this.screeningService.getIntakeResponses(childId),
    );
    const answers = this.toAnsweredQuestions(responses);
    if (answers.length === 0) return null;

    // Phase 2 (issue #135): consent-gated inside MediaService (media_capture) — returns []
    // when that consent isn't granted, the same fail-closed shape as "no photos exist yet".
    const photos = await this.mediaService.getAnalyzablePhotos(childId);
    const evidenceModalities = this.toEvidenceModalities(answers, photos);

    const contentHash = this.hashAnsweredQuestions(
      child.age_band,
      child.gender,
      answers,
      photos,
    );
    const cached = await this.repository.getCachedAiSummary(childId);
    // Re-validated on every read, not just at generation time (PR #105 QA): the
    // content-safety rules can gain new checks over time, so a narrative cached under an
    // older, weaker check must never keep serving unsafe content indefinitely just
    // because the underlying answers haven't changed since it was generated.
    if (
      cached &&
      cached.contentHash === contentHash &&
      isSummaryStillSafe(cached.content)
    ) {
      return cached.content;
    }

    const summary = await this.generateSafeSummary(
      child.age_band,
      child.gender,
      answers,
      photos,
      evidenceModalities,
    );
    if (summary === null) return null;

    await this.repository.saveAiSummary(childId, contentHash, summary);
    return summary;
  }

  /**
   * v2's much larger free-text surface (reasoning/developmental profile/uncertainty/
   * evidence summary/tiered support priorities, on top of v1's four short fields) gives an
   * LLM generation far more chances to drift into a single soft phrase that trips the
   * content-safety check (observed live: "...useful for future conversations with any
   * professional" inside `home_recommendations`, well outside the
   * `professionalAssessmentPriorities` carve-out) — discarding an otherwise-good narrative
   * over one stray word is a real usability cost, not a safety trade-off, since a retried
   * generation is validated by the exact same fail-closed check (CLAUDE.md §8). Still fails
   * closed (returns null) if every attempt is rejected.
   */
  private async generateSafeSummary(
    ageBand: string,
    gender: string | undefined,
    answers: AiSummaryAnsweredQuestion[],
    photos: AnalyzablePhoto[],
    evidenceModalities: EvidenceModality[],
  ): Promise<AiResultsSummary | null> {
    const photoEvidence = this.toPhotoEvidence(photos);
    for (let attempt = 0; attempt < MAX_SUMMARY_GENERATION_ATTEMPTS; attempt++) {
      const rawOutput = await this.aiSummaryClient.generateSummary({
        ageBand,
        gender,
        answers,
        photos: photoEvidence,
      });
      if (rawOutput === null) return null; // transport failure: retrying won't help
      const summary = parseAiSummaryOutput(rawOutput, evidenceModalities);
      if (summary !== null) return summary;
    }
    return null;
  }

  /** Raw decrypted bytes never leave this method as anything but base64 for one LLM call. */
  private toPhotoEvidence(photos: AnalyzablePhoto[]): AiSummaryPhotoEvidence[] {
    return photos.map((photo) => ({
      mimeType: photo.mimeType,
      base64Data: photo.data.toString('base64'),
    }));
  }

  /**
   * Computed from what THIS call actually sends, never from the model's own output (issue
   * #135) — see EvidenceModality's doc comment in vocabulary.ts for why that matters.
   */
  private toEvidenceModalities(
    answers: AiSummaryAnsweredQuestion[],
    photos: AnalyzablePhoto[],
  ): EvidenceModality[] {
    const modalities: EvidenceModality[] = ['structured_answers'];
    if (answers.some((answer) => answer.freeText)) modalities.push('free_text');
    if (photos.length > 0) modalities.push('photo');
    return modalities;
  }

  /**
   * The Comparison Section (CLAUDE.md §13/§14, dual-assessment update 2026-07-11): a THIRD,
   * standalone computation run AFTER Assessment A and Assessment B have each independently
   * produced their own output (rule 7, §2 — it never feeds either engine's output back into
   * the other, and @earlysteps/comparison-engine's inputs are Pick<>-typed to exactly the
   * fields it may read). Same ai_analysis consent gate as the rest of this service. Returns
   * null (section doesn't render) when there is no AI summary yet (no answers, consent/tier
   * gate, transport failure, or a malformed/unsafe model response) or no computed Assessment
   * A view yet — fail closed, same precedent as getResultsSummary.
   *
   * Deliberately NOT cached: this is a cheap, pure function over two already-computed
   * inputs, each with its own independent cache/recompute lifecycle — caching this result
   * too would need its own invalidation key tracking both sides' staleness at once, which
   * isn't worth it while it's this cheap to just recompute.
   */
  async getComparisonResult(childId: string): Promise<ComparisonResult | null> {
    await this.ensureAiAnalysisConsent(childId);

    const summary = await this.getResultsSummary(childId);
    if (summary === null) return null;

    const resultsView = await this.screeningService.getResults(childId).catch(() => null);
    if (resultsView === null) return null;

    return compareAssessments(resultsView, summary);
  }

  /**
   * Reduces this session's questionnaire responses to what the results-summary prompt
   * needs: question text, selected option labels, and any typed note (PII minimization,
   * CLAUDE.md §8). Responses whose question_id isn't a real questionnaire question (e.g.
   * a follow-up confirmation) are skipped, same as ResultsScreen's own strengths
   * derivation — this narrative covers the questionnaire itself, not its confirmations.
   */
  private toAnsweredQuestions(responses: IntakeResponse[]): AiSummaryAnsweredQuestion[] {
    const questionsById = new Map(allQuestions().map((q) => [q.id, q]));
    const answers: AiSummaryAnsweredQuestion[] = [];
    for (const response of responses) {
      const question = questionsById.get(response.question_id);
      if (!question) continue;
      const selectedIds = Array.isArray(response.answer)
        ? response.answer
        : [String(response.answer)];
      const selectedLabels: string[] = [];
      let freeText: string | undefined;
      for (const id of selectedIds) {
        if (isFreeTextAnswer(id)) {
          freeText = stripFreeTextPrefix(id);
          continue;
        }
        const option = question.options.find((o) => o.id === id);
        if (option) selectedLabels.push(option.label);
      }
      answers.push({
        questionText: question.text,
        selectedLabels,
        ...(freeText ? { freeText } : {}),
      });
    }
    return answers;
  }

  /**
   * Stable hash of the answered-question set plus the analyzed photo set, sorted so
   * storage/fetch order never matters. Photo ids only (never raw bytes, issue #135) — enough
   * to bust the cache when a photo is captured or deleted without re-hashing binary content.
   */
  private hashAnsweredQuestions(
    ageBand: string,
    gender: string | undefined,
    answers: AiSummaryAnsweredQuestion[],
    photos: AnalyzablePhoto[],
  ): string {
    const sortedAnswers = [...answers].sort((a, b) =>
      a.questionText.localeCompare(b.questionText),
    );
    const photoIds = photos.map((photo) => photo.id).sort();
    const stable = JSON.stringify({
      ageBand,
      gender: gender ?? null,
      answers: sortedAnswers,
      photoIds,
    });
    return createHash('sha256').update(stable).digest('hex');
  }

  private async ensureAiAnalysisConsent(childId: string): Promise<void> {
    const hasConsent = await this.familiesRepository.hasConsent(childId, 'ai_analysis');
    if (!hasConsent) {
      throw new ForbiddenException(
        'AI analysis of typed answers requires ai_analysis consent for this child.',
      );
    }
  }

  private async pendingSuggestionViews(childId: string): Promise<FollowUpSuggestion[]> {
    const pending = await this.repository.getPendingSuggestions(childId);
    const views: FollowUpSuggestion[] = [];
    for (const suggestion of pending) {
      const view = this.toView(suggestion);
      if (view) views.push(view);
    }
    return views;
  }

  /** Resolves the content-authored question. Unresolvable content fails closed. */
  private toView(suggestion: StoredFollowUpSuggestion): FollowUpSuggestion | null {
    const followUp = getFollowUp(suggestion.followUpId);
    if (!followUp) {
      this.logger.warn(
        `follow-up ${suggestion.followUpId} not found in content — skipping suggestion ${suggestion.id}`,
      );
      return null;
    }
    return {
      id: suggestion.id,
      follow_up_id: suggestion.followUpId,
      red_flag_type: suggestion.redFlagType,
      text: followUp.text,
      hint: followUp.hint,
      source_question_id: suggestion.sourceQuestionId,
      source_quote: suggestion.sourceQuote,
    };
  }
}
