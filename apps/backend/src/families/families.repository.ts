/**
 * Port (interface) FamiliesService depends on. Two implementations exist:
 *  - PrismaFamiliesRepository (production, real Postgres via Prisma)
 *  - InMemoryFamiliesRepository (test double, src/families/testing/ — never wired into
 *    AppModule)
 *
 * ScreeningService also depends on this port directly (just the `hasConsent` method) rather
 * than through an extra wrapper class — see screening.service.ts.
 */
import type {
  Child,
  ConsentScope,
  Family,
  GenderOption,
  MediaRetentionDays,
} from '@earlysteps/shared-types';

export const FAMILIES_REPOSITORY = Symbol('FAMILIES_REPOSITORY');

export interface CreateFamilyInput {
  locale: string;
  lowBandwidthMode?: boolean;
  /**
   * Links the family to the logged-in account that created it (issue #23). Omitted/null
   * for a guest session — matches today's fully anonymous behaviour exactly.
   */
  userId?: string | null;
}

export interface CreateChildInput {
  nickname: string;
  /** Month (1–12) + year of birth — the age band is derived from these, never stored (#25). */
  birthMonth: number;
  birthYear: number;
  gender?: GenderOption;
  genderDetail?: string;
  languages: string[];
}

export interface FamiliesRepository {
  createFamily(input: CreateFamilyInput): Promise<Family>;
  getFamily(familyId: string): Promise<Family | null>;
  /**
   * The account that owns this family (issue #23) — null for an anonymous/guest family,
   * undefined when no such family exists at all. Powers FamilyOwnershipGuard: an unowned
   * family stays unrestricted, exactly matching today's behaviour.
   */
  getFamilyOwnerUserId(familyId: string): Promise<string | null | undefined>;
  /** The one family already linked to this account, if any — recovery on a new device. */
  getFamilyByUserId(userId: string): Promise<Family | null>;
  /** Updates exactly one consent scope — matches <ConsentToggle/>'s one-scope-per-call UX. */
  updateConsent(familyId: string, scope: ConsentScope, granted: boolean): Promise<Family>;
  /**
   * Parent-facing media retention window (issue #142, product plan §5 item 13). Retroactive:
   * also recomputes retentionExpiresAt = capturedAt + days on every already-captured,
   * non-deleted, non-retained MediaAsset under this family — a tightened window takes
   * effect immediately, not just for future captures. Never touches an asset the parent
   * has explicitly retained (retainedByParent), same exemption the retention sweep honors.
   */
  updateMediaRetentionDays(familyId: string, days: MediaRetentionDays): Promise<Family>;
  createChild(familyId: string, input: CreateChildInput): Promise<Child>;
  getChild(childId: string): Promise<Child | null>;
  /** Every child recorded under a family — the child switcher's data source (issue #23). */
  getChildrenByFamily(familyId: string): Promise<Child[]>;
  /** Fail-safe default: a child/family with no recorded grant has NOT consented. */
  hasConsent(childId: string, scope: ConsentScope): Promise<boolean>;
  /**
   * Storage keys of every media blob stored under this family's children (issue #134) —
   * read by FamiliesService.deleteFamily BEFORE the purge so the encrypted blobs can be
   * removed from object storage too, not just their DB rows.
   */
  listMediaStorageKeysByFamily(familyId: string): Promise<string[]>;
  /**
   * Right-to-erasure (issue #55, product plan Screen 13): permanently removes the family,
   * its children, and every record stored under them (answers, computed profiles,
   * estimates, red flags, follow-up suggestions, plans, logs, media refs, reports).
   * Returns false when no such family exists. Irreversible by design.
   */
  deleteFamily(familyId: string): Promise<boolean>;
}
