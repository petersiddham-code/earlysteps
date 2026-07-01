/**
 * Test double ONLY. Never register this in AppModule/ScreeningModule providers — production
 * always uses PrismaScreeningRepository. This exists so the intake -> scoring -> results
 * pipeline has real integration test coverage (CLAUDE.md §10) without a live Postgres
 * instance, which isn't available in every environment this repo is built in.
 */
import type { IntakeResponse } from '@earlysteps/shared-types';
import type { ComputedSnapshot, ScreeningRepository } from '../screening.repository.js';

export class InMemoryScreeningRepository implements ScreeningRepository {
  private readonly responsesByChild = new Map<string, IntakeResponse[]>();
  private readonly snapshotsByChild = new Map<string, ComputedSnapshot[]>();

  async saveIntakeResponses(childId: string, responses: IntakeResponse[]): Promise<void> {
    const existing = this.responsesByChild.get(childId) ?? [];
    this.responsesByChild.set(childId, [...existing, ...responses]);
  }

  async getIntakeResponses(childId: string): Promise<IntakeResponse[]> {
    return [...(this.responsesByChild.get(childId) ?? [])];
  }

  async saveComputedSnapshot(childId: string, snapshot: ComputedSnapshot): Promise<void> {
    const existing = this.snapshotsByChild.get(childId) ?? [];
    // Append-only — mirrors the Prisma repository never overwriting a prior snapshot.
    this.snapshotsByChild.set(childId, [...existing, snapshot]);
  }

  async getLatestSnapshot(childId: string): Promise<ComputedSnapshot | null> {
    const snapshots = this.snapshotsByChild.get(childId);
    if (!snapshots || snapshots.length === 0) return null;
    return snapshots[snapshots.length - 1]!;
  }

  /** Test-only helper: how many snapshots have accumulated (proves history isn't overwritten). */
  snapshotCount(childId: string): number {
    return this.snapshotsByChild.get(childId)?.length ?? 0;
  }
}
