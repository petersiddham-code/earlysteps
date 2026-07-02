import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Child, ConsentScope, Family } from '@earlysteps/shared-types';
import {
  FAMILIES_REPOSITORY,
  type CreateChildInput,
  type CreateFamilyInput,
  type FamiliesRepository,
} from './families.repository.js';

@Injectable()
export class FamiliesService {
  constructor(
    @Inject(FAMILIES_REPOSITORY) private readonly repository: FamiliesRepository,
  ) {}

  createFamily(input: CreateFamilyInput): Promise<Family> {
    return this.repository.createFamily(input);
  }

  async getFamily(familyId: string): Promise<Family> {
    const family = await this.repository.getFamily(familyId);
    if (!family) throw new NotFoundException(`No family found with id ${familyId}`);
    return family;
  }

  updateConsent(
    familyId: string,
    scope: ConsentScope,
    granted: boolean,
  ): Promise<Family> {
    return this.repository.updateConsent(familyId, scope, granted);
  }

  async createChild(familyId: string, input: CreateChildInput): Promise<Child> {
    // Fail fast with a clear 404 rather than a raw FK-constraint error from Prisma.
    await this.getFamily(familyId);
    return this.repository.createChild(familyId, input);
  }

  /**
   * Tenancy check: the child must actually belong to the family in the request path. A
   * mismatch gets the same 404 as a missing child — no confirmation that the id exists
   * under some other family. (Real account auth is still an open gap — see
   * docs/clinical-review/content-gaps.md §6 — but this stops one family's URL from ever
   * addressing another family's child once it lands.)
   */
  async getChild(familyId: string, childId: string): Promise<Child> {
    const child = await this.repository.getChild(childId);
    if (!child || child.family_id !== familyId) {
      throw new NotFoundException(`No child found with id ${childId}`);
    }
    return child;
  }
}
