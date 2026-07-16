import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  deriveAgeBand,
  type Child,
  type ConsentScope,
  type Family,
} from '@earlysteps/shared-types';
import {
  FAMILIES_REPOSITORY,
  type CreateChildInput,
  type CreateFamilyInput,
  type FamiliesRepository,
} from './families.repository.js';
import {
  OBJECT_STORAGE_SERVICE,
  type ObjectStorageService,
} from '../media/object-storage/object-storage.js';

@Injectable()
export class FamiliesService {
  private readonly logger = new Logger(FamiliesService.name);

  constructor(
    @Inject(FAMILIES_REPOSITORY) private readonly repository: FamiliesRepository,
    @Inject(OBJECT_STORAGE_SERVICE) private readonly storage: ObjectStorageService,
  ) {}

  /**
   * Issue #23: idempotent per account. A logged-in caller who already owns a family gets
   * that SAME family back instead of a duplicate — this is what makes "log in on a new
   * device" actually recover data rather than silently starting over. A guest session
   * (requestingUserId null) behaves exactly as before: a fresh, unowned family every time.
   */
  async createFamily(
    input: CreateFamilyInput,
    requestingUserId: string | null = null,
  ): Promise<Family> {
    if (requestingUserId) {
      const existing = await this.repository.getFamilyByUserId(requestingUserId);
      if (existing) return existing;
    }
    return this.repository.createFamily({ ...input, userId: requestingUserId });
  }

  async getFamily(familyId: string): Promise<Family> {
    const family = await this.repository.getFamily(familyId);
    if (!family) throw new NotFoundException(`No family found with id ${familyId}`);
    return family;
  }

  /** The child switcher's data source (issue #23) — every child recorded under this family. */
  async getChildren(familyId: string): Promise<Child[]> {
    await this.getFamily(familyId); // 404 rather than a silent empty list for a bad id
    return this.repository.getChildrenByFamily(familyId);
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
    // The band is derived, never sent by the client (#25). Strict derivation here: a child
    // outside the supported 12-month–25-year range gets a clear 400 at creation, while
    // read paths clamp to the nearest band (a child aging out mustn't break the app).
    if (deriveAgeBand(input.birthMonth, input.birthYear) === null) {
      throw new BadRequestException(
        'Our check-ins are designed for ages 12 months to 25 years. Please check the birth month and year.',
      );
    }
    // gender_detail is only meaningful alongside self_describe — drop it otherwise so a
    // stray value can never be stored against a child unintentionally (data minimization).
    const genderDetail =
      input.gender === 'self_describe' ? input.genderDetail : undefined;
    return this.repository.createChild(familyId, { ...input, genderDetail });
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

  /**
   * Right-to-erasure (issue #55, product plan Screen 13): permanently removes the family
   * and everything stored under it — children, answers, computed profiles, red flags,
   * follow-ups. Irreversible; the client is expected to have shown its own confirmation
   * step before calling.
   */
  async deleteFamily(familyId: string): Promise<void> {
    // Issue #134: media blobs live in object storage, not the database — collect their
    // keys BEFORE the purge (which removes the rows pointing at them), then delete the
    // blobs once the purge has committed. Blob deletion is after (not inside) the DB
    // transaction so a storage hiccup can't leave the family half-deleted; a blob that
    // survives a failed delete is unreadable anyway — its family's encryption key was
    // just destroyed with the Family row (cryptographic erasure as the backstop).
    const storageKeys = await this.repository.listMediaStorageKeysByFamily(familyId);
    const deleted = await this.repository.deleteFamily(familyId);
    if (!deleted) throw new NotFoundException(`No family found with id ${familyId}`);
    const results = await Promise.allSettled(
      storageKeys.map((key) => this.storage.delete(key)),
    );
    for (const result of results) {
      if (result.status === 'rejected') {
        // Log-and-continue: the parent's data is gone from the DB and the key is gone,
        // so failing the whole request over a leftover ciphertext blob helps no one.
        this.logger.error(
          'Failed to delete a media blob during family erasure',
          result.reason instanceof Error ? result.reason.stack : String(result.reason),
        );
      }
    }
  }
}
