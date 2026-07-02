/**
 * Port (interface) the AnalysisService depends on. Two implementations exist:
 *  - PrismaAnalysisRepository (production, real Postgres via Prisma)
 *  - InMemoryAnalysisRepository (test double, src/analysis/testing/ — never wired into
 *    AppModule), mirroring the screening/families repository pattern.
 */
import type {
  IntakeResponse,
  RedFlagType,
  SignalSalience,
} from '@earlysteps/shared-types';

export interface StoredFollowUpSuggestion {
  id: string;
  childId: string;
  /** Follow-up question id in packages/content/follow-ups (FU_<red_flag_type>). */
  followUpId: string;
  redFlagType: RedFlagType;
  sourceQuestionId: string;
  /** The caregiver's own typed words, verbatim (free_text: prefix stripped). */
  sourceQuote: string;
  salience: SignalSalience;
  status: 'pending' | 'answered';
}

export interface CreateSuggestionInput {
  followUpId: string;
  redFlagType: RedFlagType;
  sourceQuestionId: string;
  sourceQuote: string;
  salience: SignalSalience;
}

export const ANALYSIS_REPOSITORY = Symbol('ANALYSIS_REPOSITORY');

export interface AnalysisRepository {
  /**
   * Intake responses whose answer array contains at least one free_text: entry and
   * that the analysis stage has not yet processed.
   */
  getUnanalyzedFreeTextResponses(childId: string): Promise<IntakeResponse[]>;
  /** Marks responses as processed so the same typed text is never analyzed twice. */
  markResponsesAnalyzed(childId: string, responses: IntakeResponse[]): Promise<void>;
  /**
   * Creates a suggestion unless one for the same follow-up already exists for this
   * child (pending OR answered) — the caregiver is asked each confirmation at most
   * once; repeat mentions never nag.
   */
  createSuggestion(childId: string, input: CreateSuggestionInput): Promise<void>;
  getPendingSuggestions(childId: string): Promise<StoredFollowUpSuggestion[]>;
  getSuggestion(
    childId: string,
    suggestionId: string,
  ): Promise<StoredFollowUpSuggestion | null>;
  markSuggestionAnswered(childId: string, suggestionId: string): Promise<void>;
}
