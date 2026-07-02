/**
 * Test double ONLY. Never register this in AppModule/AnalysisModule providers —
 * production always uses PrismaAnalysisRepository. Reads intake responses from an
 * InMemoryScreeningRepository so the analysis pipeline can be integration-tested
 * against the same stored answers the scoring pipeline sees.
 */
import { isFreeTextAnswer, type IntakeResponse } from '@earlysteps/shared-types';
import type { InMemoryScreeningRepository } from '../../screening/testing/in-memory-screening.repository.js';
import type {
  AnalysisRepository,
  CreateSuggestionInput,
  StoredFollowUpSuggestion,
} from '../analysis.repository.js';

let nextId = 0;
function generateId(): string {
  nextId += 1;
  return `suggestion-${nextId}`;
}

function responseKey(response: IntakeResponse): string {
  return `${response.question_id}|${response.timestamp}`;
}

function containsFreeText(answer: IntakeResponse['answer']): boolean {
  if (Array.isArray(answer)) return answer.some((entry) => isFreeTextAnswer(entry));
  return typeof answer === 'string' && isFreeTextAnswer(answer);
}

export class InMemoryAnalysisRepository implements AnalysisRepository {
  private readonly analyzedKeysByChild = new Map<string, Set<string>>();
  private readonly suggestions: StoredFollowUpSuggestion[] = [];

  constructor(private readonly screeningRepository: InMemoryScreeningRepository) {}

  async getUnanalyzedFreeTextResponses(childId: string): Promise<IntakeResponse[]> {
    const analyzed = this.analyzedKeysByChild.get(childId) ?? new Set<string>();
    const responses = await this.screeningRepository.getIntakeResponses(childId);
    return responses.filter(
      (r) => containsFreeText(r.answer) && !analyzed.has(responseKey(r)),
    );
  }

  async markResponsesAnalyzed(
    childId: string,
    responses: IntakeResponse[],
  ): Promise<void> {
    const analyzed = this.analyzedKeysByChild.get(childId) ?? new Set<string>();
    for (const response of responses) analyzed.add(responseKey(response));
    this.analyzedKeysByChild.set(childId, analyzed);
  }

  async createSuggestion(childId: string, input: CreateSuggestionInput): Promise<void> {
    const exists = this.suggestions.some(
      (s) => s.childId === childId && s.followUpId === input.followUpId,
    );
    if (exists) return;
    this.suggestions.push({ id: generateId(), childId, status: 'pending', ...input });
  }

  async getPendingSuggestions(childId: string): Promise<StoredFollowUpSuggestion[]> {
    return this.suggestions.filter(
      (s) => s.childId === childId && s.status === 'pending',
    );
  }

  async getSuggestion(
    childId: string,
    suggestionId: string,
  ): Promise<StoredFollowUpSuggestion | null> {
    return (
      this.suggestions.find((s) => s.childId === childId && s.id === suggestionId) ?? null
    );
  }

  async markSuggestionAnswered(childId: string, suggestionId: string): Promise<void> {
    const suggestion = this.suggestions.find(
      (s) => s.childId === childId && s.id === suggestionId && s.status === 'pending',
    );
    if (suggestion) suggestion.status = 'answered';
  }
}
