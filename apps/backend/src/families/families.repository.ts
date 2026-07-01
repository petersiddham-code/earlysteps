/**
 * Port (interface) FamiliesService depends on. Two implementations exist:
 *  - PrismaFamiliesRepository (production, real Postgres via Prisma)
 *  - InMemoryFamiliesRepository (test double, src/families/testing/ — never wired into
 *    AppModule)
 *
 * ScreeningService also depends on this port directly (just the `hasConsent` method) rather
 * than through an extra wrapper class — see screening.service.ts.
 */
import type { AgeBand, Child, ConsentScope, Family } from '@earlysteps/shared-types';

export const FAMILIES_REPOSITORY = Symbol('FAMILIES_REPOSITORY');

export interface CreateFamilyInput {
  locale: string;
  lowBandwidthMode?: boolean;
}

export interface CreateChildInput {
  nickname: string;
  ageBand: AgeBand;
  languages: string[];
}

export interface FamiliesRepository {
  createFamily(input: CreateFamilyInput): Promise<Family>;
  getFamily(familyId: string): Promise<Family | null>;
  /** Updates exactly one consent scope — matches <ConsentToggle/>'s one-scope-per-call UX. */
  updateConsent(familyId: string, scope: ConsentScope, granted: boolean): Promise<Family>;
  createChild(familyId: string, input: CreateChildInput): Promise<Child>;
  getChild(childId: string): Promise<Child | null>;
  /** Fail-safe default: a child/family with no recorded grant has NOT consented. */
  hasConsent(childId: string, scope: ConsentScope): Promise<boolean>;
}
