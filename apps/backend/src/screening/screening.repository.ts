/**
 * Port (interface) the ScreeningService depends on. Two implementations exist:
 *  - PrismaScreeningRepository (production, real Postgres via Prisma)
 *  - InMemoryScreeningRepository (test double, src/screening/testing/ — never wired into
 *    AppModule; see that file's doc comment)
 *
 * Keeping this as an interface is what lets the pipeline's integration tests exercise real
 * intake -> recompute -> persist -> results-view logic without a live database.
 */
import type {
  DomainProfile,
  IntakeResponse,
  RedFlag,
  SupportLevelEstimate,
} from '@earlysteps/shared-types';

export interface ComputedSnapshot {
  profile: DomainProfile;
  supportEstimate: SupportLevelEstimate | null;
  redFlags: RedFlag[];
}

export const SCREENING_REPOSITORY = Symbol('SCREENING_REPOSITORY');

export interface ScreeningRepository {
  saveIntakeResponses(childId: string, responses: IntakeResponse[]): Promise<void>;
  /** Full answer history for the child — recompute() scores against everything so far. */
  getIntakeResponses(childId: string): Promise<IntakeResponse[]>;
  /** Persists a new snapshot. Never overwrites a prior one (CLAUDE.md §7 — history retained). */
  saveComputedSnapshot(childId: string, snapshot: ComputedSnapshot): Promise<void>;
  getLatestSnapshot(childId: string): Promise<ComputedSnapshot | null>;
}
