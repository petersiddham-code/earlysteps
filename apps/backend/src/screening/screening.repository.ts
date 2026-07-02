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
  AgeBand,
  DomainProfile,
  IntakeResponse,
  RedFlag,
  SupportLevelEstimate,
} from '@earlysteps/shared-types';

export interface ComputedSnapshot {
  /**
   * The child's (derived) age band when this screening was computed. The band itself is
   * derived from birth month/year and changes as the child ages (#25), so trend history
   * must record which band each screening actually used.
   */
  ageBand: AgeBand;
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
