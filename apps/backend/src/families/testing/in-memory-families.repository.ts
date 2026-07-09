/**
 * Test double ONLY. Never register this in AppModule/FamiliesModule providers — production
 * always uses PrismaFamiliesRepository. Mirrors the real repository's fail-safe default:
 * `hasConsent()` returns false for anything not explicitly granted, so tests can't
 * accidentally rely on a permissive-by-default double masking a missing consent check.
 */
import {
  ageInMonths,
  deriveAgeBandOrNearest,
  type Child,
  type ConsentScope,
  type Family,
} from '@earlysteps/shared-types';
import type {
  CreateChildInput,
  CreateFamilyInput,
  FamiliesRepository,
} from '../families.repository.js';

let nextId = 0;
function generateId(prefix: string): string {
  nextId += 1;
  return `${prefix}-${nextId}`;
}

/** Test helper: the birth month/year of a child exactly `months` old right now. */
export function bornMonthsAgo(months: number): {
  birthMonth: number;
  birthYear: number;
} {
  const now = new Date();
  const total = now.getFullYear() * 12 + now.getMonth() - months;
  const birthMonth = (total % 12) + 1;
  const birthYear = Math.floor(total / 12);
  // Sanity-check with the real derivation math so the helper can't silently drift.
  if (ageInMonths(birthMonth, birthYear, now) !== months) {
    throw new Error(`bornMonthsAgo(${months}) produced an inconsistent date`);
  }
  return { birthMonth, birthYear };
}

export class InMemoryFamiliesRepository implements FamiliesRepository {
  private readonly families = new Map<string, Family>();
  private readonly children = new Map<string, Child>();

  /**
   * Mirrors the production purge (issue #55): the Prisma implementation deletes every
   * child-linked record in the same transaction, but the in-memory screening data lives in
   * a SEPARATE test double — tests wire this hook to it so deleteFamily behaves like the
   * real thing end-to-end.
   */
  onDeleteChildren: ((childIds: string[]) => Promise<void>) | null = null;

  async deleteFamily(familyId: string): Promise<boolean> {
    if (!this.families.has(familyId)) return false;
    const childIds = [...this.children.values()]
      .filter((child) => child.family_id === familyId)
      .map((child) => child.id);
    if (this.onDeleteChildren) await this.onDeleteChildren(childIds);
    for (const id of childIds) this.children.delete(id);
    this.families.delete(familyId);
    return true;
  }

  async createFamily(input: CreateFamilyInput): Promise<Family> {
    const family: Family = {
      id: generateId('family'),
      locale: input.locale,
      low_bandwidth_mode: input.lowBandwidthMode ?? false,
      consent_flags: {},
    };
    this.families.set(family.id, family);
    return family;
  }

  async getFamily(familyId: string): Promise<Family | null> {
    return this.families.get(familyId) ?? null;
  }

  async updateConsent(
    familyId: string,
    scope: ConsentScope,
    granted: boolean,
  ): Promise<Family> {
    const existing = this.families.get(familyId);
    if (!existing) throw new Error(`No family found with id ${familyId}`);
    const updated: Family = {
      ...existing,
      consent_flags: { ...existing.consent_flags, [scope]: granted },
    };
    this.families.set(familyId, updated);
    return updated;
  }

  async createChild(familyId: string, input: CreateChildInput): Promise<Child> {
    const child: Child = {
      id: generateId('child'),
      family_id: familyId,
      nickname: input.nickname,
      birth_month: input.birthMonth,
      birth_year: input.birthYear,
      age_band: deriveAgeBandOrNearest(input.birthMonth, input.birthYear),
      ...(input.gender ? { gender: input.gender } : {}),
      ...(input.genderDetail ? { gender_detail: input.genderDetail } : {}),
      languages: input.languages,
    };
    this.children.set(child.id, child);
    return child;
  }

  async getChild(childId: string): Promise<Child | null> {
    const child = this.children.get(childId);
    if (!child) return null;
    // Mirror the real repository: the band is derived at READ time, never trusted from
    // storage — a child ages into the next band between sessions (#25).
    return {
      ...child,
      age_band: deriveAgeBandOrNearest(child.birth_month, child.birth_year),
    };
  }

  async hasConsent(childId: string, scope: ConsentScope): Promise<boolean> {
    const child = this.children.get(childId);
    if (!child) return false;
    const family = this.families.get(child.family_id);
    if (!family) return false;
    return family.consent_flags[scope] === true;
  }

  /** Test-only shortcut: create a family + child pair, optionally pre-granting consent. */
  async seedChildWithConsent(
    grantedScopes: ConsentScope[] = [],
    childInput: CreateChildInput = {
      nickname: 'Test Child',
      // 24 months old at test time — squarely in the toddler band.
      ...bornMonthsAgo(24),
      languages: ['English'],
    },
  ): Promise<{ family: Family; child: Child }> {
    const family = await this.createFamily({ locale: 'en' });
    for (const scope of grantedScopes) {
      await this.updateConsent(family.id, scope, true);
    }
    const child = await this.createChild(family.id, childInput);
    return { family, child };
  }
}
