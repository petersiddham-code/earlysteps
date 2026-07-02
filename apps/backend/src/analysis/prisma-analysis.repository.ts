import { Injectable } from '@nestjs/common';
import { isFreeTextAnswer, type IntakeResponse } from '@earlysteps/shared-types';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  AnalysisRepository,
  CreateSuggestionInput,
  StoredFollowUpSuggestion,
} from './analysis.repository.js';

function containsFreeText(answer: IntakeResponse['answer']): boolean {
  if (Array.isArray(answer)) return answer.some((entry) => isFreeTextAnswer(entry));
  return typeof answer === 'string' && isFreeTextAnswer(answer);
}

/** Production implementation — see prisma/schema.prisma FollowUpSuggestionRecord. */
@Injectable()
export class PrismaAnalysisRepository implements AnalysisRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getUnanalyzedFreeTextResponses(childId: string): Promise<IntakeResponse[]> {
    // Free-text detection happens in JS: `answer` is a JSONB blob and a per-child
    // response set is small, so filtering here beats a fragile JSON-path query.
    const rows = await this.prisma.intakeResponseRecord.findMany({
      where: { childId, analyzedAt: null },
      orderBy: { timestamp: 'asc' },
    });
    return rows
      .map((r) => ({
        child_id: childId,
        question_id: r.questionId,
        domain: r.domain as IntakeResponse['domain'],
        answer: r.answer as IntakeResponse['answer'],
        timestamp: r.timestamp.toISOString(),
      }))
      .filter((r) => containsFreeText(r.answer));
  }

  async markResponsesAnalyzed(
    childId: string,
    responses: IntakeResponse[],
  ): Promise<void> {
    const analyzedAt = new Date();
    for (const response of responses) {
      await this.prisma.intakeResponseRecord.updateMany({
        where: {
          childId,
          questionId: response.question_id,
          timestamp: new Date(response.timestamp),
          analyzedAt: null,
        },
        data: { analyzedAt },
      });
    }
  }

  async createSuggestion(childId: string, input: CreateSuggestionInput): Promise<void> {
    // At most one confirmation per follow-up per child, ever (pending or answered).
    const existing = await this.prisma.followUpSuggestionRecord.findFirst({
      where: { childId, followUpId: input.followUpId },
    });
    if (existing) return;
    await this.prisma.followUpSuggestionRecord.create({
      data: {
        childId,
        followUpId: input.followUpId,
        redFlagType: input.redFlagType,
        sourceQuestionId: input.sourceQuestionId,
        sourceQuote: input.sourceQuote,
        salience: input.salience,
      },
    });
  }

  async getPendingSuggestions(childId: string): Promise<StoredFollowUpSuggestion[]> {
    const rows = await this.prisma.followUpSuggestionRecord.findMany({
      where: { childId, status: 'pending' },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => this.toStored(row));
  }

  async getSuggestion(
    childId: string,
    suggestionId: string,
  ): Promise<StoredFollowUpSuggestion | null> {
    const row = await this.prisma.followUpSuggestionRecord.findFirst({
      where: { id: suggestionId, childId },
    });
    return row ? this.toStored(row) : null;
  }

  async markSuggestionAnswered(childId: string, suggestionId: string): Promise<void> {
    await this.prisma.followUpSuggestionRecord.updateMany({
      where: { id: suggestionId, childId, status: 'pending' },
      data: { status: 'answered', answeredAt: new Date() },
    });
  }

  private toStored(row: {
    id: string;
    childId: string;
    followUpId: string;
    redFlagType: string;
    sourceQuestionId: string;
    sourceQuote: string;
    salience: string;
    status: string;
  }): StoredFollowUpSuggestion {
    return {
      id: row.id,
      childId: row.childId,
      followUpId: row.followUpId,
      redFlagType: row.redFlagType as StoredFollowUpSuggestion['redFlagType'],
      sourceQuestionId: row.sourceQuestionId,
      sourceQuote: row.sourceQuote,
      salience: row.salience as StoredFollowUpSuggestion['salience'],
      status: row.status as StoredFollowUpSuggestion['status'],
    };
  }
}
