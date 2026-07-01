/**
 * Test double ONLY. Never register this in AppModule/FamiliesModule providers — production
 * always uses PrismaFamiliesRepository. Mirrors the real repository's fail-safe default:
 * `hasConsent()` returns false for anything not explicitly granted, so tests can't
 * accidentally rely on a permissive-by-default double masking a missing consent check.
 */
import type { AgeBand, Child, ConsentScope, Family } from '@earlysteps/shared-types';
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

export class InMemoryFamiliesRepository implements FamiliesRepository {
  private readonly families = new Map<string, Family>();
  private readonly children = new Map<string, Child>();

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
      age_band: input.ageBand as AgeBand,
      languages: input.languages,
    };
    this.children.set(child.id, child);
    return child;
  }

  async getChild(childId: string): Promise<Child | null> {
    return this.children.get(childId) ?? null;
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
      ageBand: 'toddler',
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
