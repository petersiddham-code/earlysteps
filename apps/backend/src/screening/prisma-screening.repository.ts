import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type {
  AgeBand,
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

  async saveIntakeResponses(
    childId: string,
    responses: IntakeResponse[],
  ): Promise<number> {
    // skipDuplicates + the (childId, questionId, timestamp) unique constraint make exact
    // replays a no-op at the database level (issue #33) — safe even across multiple
    // backend instances, where an in-process check couldn't be.
    const result = await this.prisma.intakeResponseRecord.createMany({
      data: responses.map((r) => ({
        childId,
        questionId: r.question_id,
        domain: r.domain,
        answer: r.answer,
        timestamp: new Date(r.timestamp),
      })),
      skipDuplicates: true,
    });
    return result.count;
  }

  /**
   * Postgres advisory lock keyed on the child id, held via a transaction used purely as
   * the lock scope (the work in `fn` runs on the normal client — it doesn't need to be
   * atomic with the lock, just mutually excluded per child). pg_advisory_xact_lock blocks
   * until acquired and releases automatically on commit/rollback, so a crash mid-cycle
   * can never leave the child locked. Works across multiple backend instances.
   */
  async withChildLock<T>(childId: string, fn: () => Promise<T>): Promise<T> {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('intake_submit'), hashtext(${childId}))`;
        return fn();
      },
      // Generous ceilings: a waiter queued behind several concurrent submissions must not
      // time out while holding its place in line (recompute itself is in-memory and fast).
      { maxWait: 10_000, timeout: 30_000 },
    );
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

  /**
   * All-or-nothing: the profile, estimate, and red flags of one recompute() are a single
   * logical snapshot, so they commit in one transaction — a mid-write failure must never
   * leave a profile without its red flags (getLatestSnapshot pairs them by computedAt).
   */
  async saveComputedSnapshot(childId: string, snapshot: ComputedSnapshot): Promise<void> {
    const computedAt = new Date(snapshot.profile.computed_at);
    const writes: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.domainProfileRecord.create({
        data: {
          childId,
          computedAt,
          ageBand: snapshot.ageBand,
          findings: snapshot.profile.findings as unknown as Prisma.InputJsonValue,
        },
      }),
    ];
    if (snapshot.supportEstimate) {
      writes.push(
        this.prisma.supportLevelEstimateRecord.create({
          data: {
            childId,
            level: snapshot.supportEstimate.level,
            confidence: snapshot.supportEstimate.confidence,
            computedAt: new Date(snapshot.supportEstimate.computed_at),
          },
        }),
      );
    }
    if (snapshot.redFlags.length > 0) {
      writes.push(
        this.prisma.redFlagRecord.createMany({
          data: snapshot.redFlags.map((f) => ({
            childId,
            type: f.type,
            triggeredAt: new Date(f.triggered_at),
            evidenceRefs: f.evidence_refs as unknown as Prisma.InputJsonValue,
            resolved: f.resolved,
          })),
        }),
      );
    }
    await this.prisma.$transaction(writes);
  }

  async getLatestSnapshot(childId: string): Promise<ComputedSnapshot | null> {
    const profileRow = await this.prisma.domainProfileRecord.findFirst({
      where: { childId },
      orderBy: { computedAt: 'desc' },
    });
    if (!profileRow) return null;

    // The estimate and red flags are matched to the profile's own computedAt (recompute()
    // stamps all three identically) — never "latest of each" independently, which could
    // pair a newer profile with a stale estimate from an earlier snapshot.
    const [estimateRow, redFlagRows] = await Promise.all([
      this.prisma.supportLevelEstimateRecord.findFirst({
        where: { childId, computedAt: profileRow.computedAt },
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
      ageBand: profileRow.ageBand as AgeBand,
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
