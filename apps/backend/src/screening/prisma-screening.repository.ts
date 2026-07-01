import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  Confidence,
  DomainFinding,
  EvidenceRef,
  IntakeResponse,
  RedFlag,
  RedFlagType,
  SupportLevel,
  SupportLevelEstimate,
} from '@earlysteps/shared-types';
import { PrismaService } from '../prisma/prisma.service.js';
import type { ComputedSnapshot, ScreeningRepository } from './screening.repository.js';

/** Production implementation — the child row must already exist (see README §out-of-scope). */
@Injectable()
export class PrismaScreeningRepository implements ScreeningRepository {
  constructor(private readonly prisma: PrismaService) {}

  async saveIntakeResponses(childId: string, responses: IntakeResponse[]): Promise<void> {
    await this.prisma.intakeResponseRecord.createMany({
      data: responses.map((r) => ({
        childId,
        questionId: r.question_id,
        domain: r.domain,
        answer: r.answer,
        timestamp: new Date(r.timestamp),
      })),
    });
  }

  async getIntakeResponses(childId: string): Promise<IntakeResponse[]> {
    const rows = await this.prisma.intakeResponseRecord.findMany({
      where: { childId },
      orderBy: { timestamp: 'asc' },
    });
    return rows.map((r) => ({
      child_id: childId,
      question_id: r.questionId,
      domain: r.domain as IntakeResponse['domain'],
      answer: r.answer as IntakeResponse['answer'],
      timestamp: r.timestamp.toISOString(),
    }));
  }

  async saveComputedSnapshot(childId: string, snapshot: ComputedSnapshot): Promise<void> {
    const computedAt = new Date(snapshot.profile.computed_at);
    await this.prisma.domainProfileRecord.create({
      data: {
        childId,
        computedAt,
        findings: snapshot.profile.findings as unknown as Prisma.InputJsonValue,
      },
    });
    if (snapshot.supportEstimate) {
      await this.prisma.supportLevelEstimateRecord.create({
        data: {
          childId,
          level: snapshot.supportEstimate.level,
          confidence: snapshot.supportEstimate.confidence,
          computedAt: new Date(snapshot.supportEstimate.computed_at),
        },
      });
    }
    if (snapshot.redFlags.length > 0) {
      await this.prisma.redFlagRecord.createMany({
        data: snapshot.redFlags.map((f) => ({
          childId,
          type: f.type,
          triggeredAt: new Date(f.triggered_at),
          evidenceRefs: f.evidence_refs as unknown as Prisma.InputJsonValue,
          resolved: f.resolved,
        })),
      });
    }
  }

  async getLatestSnapshot(childId: string): Promise<ComputedSnapshot | null> {
    const profileRow = await this.prisma.domainProfileRecord.findFirst({
      where: { childId },
      orderBy: { computedAt: 'desc' },
    });
    if (!profileRow) return null;

    const [estimateRow, redFlagRows] = await Promise.all([
      this.prisma.supportLevelEstimateRecord.findFirst({
        where: { childId },
        orderBy: { computedAt: 'desc' },
      }),
      this.prisma.redFlagRecord.findMany({
        where: { childId, triggeredAt: profileRow.computedAt },
      }),
    ]);

    const supportEstimate: SupportLevelEstimate | null = estimateRow
      ? {
          child_id: childId,
          level: estimateRow.level as SupportLevel,
          confidence: estimateRow.confidence as Confidence,
          computed_at: estimateRow.computedAt.toISOString(),
        }
      : null;

    const redFlags: RedFlag[] = redFlagRows.map((f) => ({
      child_id: childId,
      type: f.type as RedFlagType,
      triggered_at: f.triggeredAt.toISOString(),
      evidence_refs: f.evidenceRefs as unknown as EvidenceRef[],
      resolved: f.resolved,
    }));

    return {
      profile: {
        child_id: childId,
        computed_at: profileRow.computedAt.toISOString(),
        findings: profileRow.findings as unknown as DomainFinding[],
      },
      supportEstimate,
      redFlags,
    };
  }
}
