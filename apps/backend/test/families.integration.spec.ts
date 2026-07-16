/**
 * Integration test for family/child onboarding and layered consent (product plan §4.7,
 * CLAUDE.md §2 rule 9). Runs against InMemoryFamiliesRepository — no live Postgres required.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FamiliesService } from '../src/families/families.service.js';
import { FAMILIES_REPOSITORY } from '../src/families/families.repository.js';
import {
  InMemoryFamiliesRepository,
  bornMonthsAgo,
} from '../src/families/testing/in-memory-families.repository.js';
import { OBJECT_STORAGE_SERVICE } from '../src/media/object-storage/object-storage.js';
import { InMemoryObjectStorageService } from '../src/media/testing/in-memory-object-storage.service.js';

async function buildService() {
  const repository = new InMemoryFamiliesRepository();
  const moduleRef = await Test.createTestingModule({
    providers: [
      FamiliesService,
      { provide: FAMILIES_REPOSITORY, useValue: repository },
      // Issue #134: deleteFamily purges media blobs through this port.
      { provide: OBJECT_STORAGE_SERVICE, useValue: new InMemoryObjectStorageService() },
    ],
  }).compile();
  return { service: moduleRef.get(FamiliesService), repository };
}

describe('families — onboarding', () => {
  let service: FamiliesService;

  beforeEach(async () => {
    ({ service } = await buildService());
  });

  it('creates a family with no consent granted by default (fail-safe)', async () => {
    const family = await service.createFamily({ locale: 'en' });
    expect(family.consent_flags).toEqual({});
    expect(family.low_bandwidth_mode).toBe(false);
  });

  it('getFamily throws NotFoundException for an unknown family', async () => {
    await expect(service.getFamily('unknown-family')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('creates a child under an existing family', async () => {
    const family = await service.createFamily({ locale: 'en' });
    const child = await service.createChild(family.id, {
      nickname: 'Alex',
      ...bornMonthsAgo(24), // 24 months old — toddler
      languages: ['English'],
    });
    expect(child.family_id).toBe(family.id);
    expect(child.nickname).toBe('Alex');
  });

  it('refuses to create a child under a non-existent family (clear 404, not a raw FK error)', async () => {
    await expect(
      service.createChild('unknown-family', {
        nickname: 'Alex',
        ageBand: 'toddler',
        languages: ['English'],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getChild throws NotFoundException for an unknown child', async () => {
    const family = await service.createFamily({ locale: 'en' });
    await expect(service.getChild(family.id, 'unknown-child')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('getChild returns the child when queried under its own family', async () => {
    const family = await service.createFamily({ locale: 'en' });
    const child = await service.createChild(family.id, {
      nickname: 'Alex',
      ...bornMonthsAgo(24), // 24 months old — toddler
      languages: ['English'],
    });
    await expect(service.getChild(family.id, child.id)).resolves.toMatchObject({
      id: child.id,
      family_id: family.id,
    });
  });

  it('derives the age band from birth month/year — never stored-as-entered (#25)', async () => {
    const family = await service.createFamily({ locale: 'en' });

    const toddler = await service.createChild(family.id, {
      nickname: 'Alex',
      ...bornMonthsAgo(24),
      languages: ['English'],
    });
    expect(toddler.age_band).toBe('toddler');

    // 40 months: a coarse year-difference would call this toddler; month math says preschool.
    const preschooler = await service.createChild(family.id, {
      nickname: 'Sam',
      ...bornMonthsAgo(40),
      languages: ['English'],
    });
    expect(preschooler.age_band).toBe('preschool');

    // The read path re-derives too — age_band stays on the API surface for consumers.
    await expect(service.getChild(family.id, toddler.id)).resolves.toMatchObject({
      age_band: 'toddler',
      birth_month: toddler.birth_month,
      birth_year: toddler.birth_year,
    });
  });

  it('rejects a birth date outside the supported 12-month–25-year range with a clear 400', async () => {
    const family = await service.createFamily({ locale: 'en' });

    for (const months of [6, 320]) {
      await expect(
        service.createChild(family.id, {
          nickname: 'Alex',
          ...bornMonthsAgo(months),
          languages: ['English'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('gender is optional, and a self-description only persists alongside self_describe (#25)', async () => {
    const family = await service.createFamily({ locale: 'en' });

    const skipped = await service.createChild(family.id, {
      nickname: 'Alex',
      ...bornMonthsAgo(24),
      languages: ['English'],
    });
    expect(skipped.gender).toBeUndefined();
    expect(skipped.gender_detail).toBeUndefined();

    const selfDescribed = await service.createChild(family.id, {
      nickname: 'Sam',
      ...bornMonthsAgo(24),
      gender: 'self_describe',
      genderDetail: 'nonbinary',
      languages: ['English'],
    });
    expect(selfDescribed.gender).toBe('self_describe');
    expect(selfDescribed.gender_detail).toBe('nonbinary');

    // A stray detail without self_describe is dropped, never silently stored.
    const strayDetail = await service.createChild(family.id, {
      nickname: 'Kim',
      ...bornMonthsAgo(24),
      gender: 'girl',
      genderDetail: 'should not persist',
      languages: ['English'],
    });
    expect(strayDetail.gender).toBe('girl');
    expect(strayDetail.gender_detail).toBeUndefined();
  });

  it("refuses to serve a child under a different family's path (tenancy, same 404 as missing)", async () => {
    const familyA = await service.createFamily({ locale: 'en' });
    const familyB = await service.createFamily({ locale: 'en' });
    const child = await service.createChild(familyA.id, {
      nickname: 'Alex',
      ...bornMonthsAgo(24), // 24 months old — toddler
      languages: ['English'],
    });

    await expect(service.getChild(familyB.id, child.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('families — layered consent (product plan §4.7)', () => {
  let service: FamiliesService;

  beforeEach(async () => {
    ({ service } = await buildService());
  });

  it('grants exactly one scope per call, leaving the others untouched', async () => {
    const family = await service.createFamily({ locale: 'en' });

    const afterFirst = await service.updateConsent(family.id, 'data_storage', true);
    expect(afterFirst.consent_flags).toEqual({ data_storage: true });

    const afterSecond = await service.updateConsent(family.id, 'ai_analysis', true);
    expect(afterSecond.consent_flags).toEqual({ data_storage: true, ai_analysis: true });
  });

  it('can revoke a previously granted scope independently of the others', async () => {
    const family = await service.createFamily({ locale: 'en' });
    await service.updateConsent(family.id, 'data_storage', true);
    await service.updateConsent(family.id, 'media_capture', true);

    const afterRevoke = await service.updateConsent(family.id, 'media_capture', false);
    expect(afterRevoke.consent_flags).toEqual({
      data_storage: true,
      media_capture: false,
    });
  });

  it('covers all four consent scopes independently (product plan §4.7)', async () => {
    const family = await service.createFamily({ locale: 'en' });
    for (const scope of [
      'data_storage',
      'ai_analysis',
      'media_capture',
      'professional_sharing',
    ] as const) {
      const updated = await service.updateConsent(family.id, scope, true);
      expect(updated.consent_flags[scope]).toBe(true);
    }
  });
});

describe('families — media retention window (issue #142, product plan §5 item 13)', () => {
  let service: FamiliesService;

  beforeEach(async () => {
    ({ service } = await buildService());
  });

  it('defaults every new family to the 90-day window', async () => {
    const family = await service.createFamily({ locale: 'en' });
    expect(family.media_retention_days).toBe(90);
  });

  it('updates to any of the shorter-only options (30/60/90)', async () => {
    const family = await service.createFamily({ locale: 'en' });

    const after30 = await service.updateMediaRetentionDays(family.id, 30);
    expect(after30.media_retention_days).toBe(30);

    const after60 = await service.updateMediaRetentionDays(family.id, 60);
    expect(after60.media_retention_days).toBe(60);
  });

  it('404s on an unknown family', async () => {
    const { service: freshService } = await buildService();
    await expect(
      freshService.updateMediaRetentionDays('no-such-family', 30),
    ).rejects.toThrow();
  });
});

describe('families — delete everything (issue #55, right to erasure)', () => {
  let service: FamiliesService;
  let repository: InMemoryFamiliesRepository;

  beforeEach(async () => {
    ({ service, repository } = await buildService());
  });

  it('deletes the family and its children; both 404 afterwards', async () => {
    const family = await service.createFamily({ locale: 'en' });
    const child = await service.createChild(family.id, {
      nickname: 'Alex',
      ...bornMonthsAgo(24),
      languages: ['English'],
    });

    await service.deleteFamily(family.id);

    await expect(service.getFamily(family.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getChild(family.id, child.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    // Fail-safe: a deleted child has no consent for anything.
    expect(await repository.hasConsent(child.id, 'data_storage')).toBe(false);
  });

  it('purges the screening data stored under every child of the family', async () => {
    // The production purge happens in one Prisma transaction; the in-memory double
    // mirrors it through the onDeleteChildren hook — this pins that the hook receives
    // every child of the family being deleted, and only those.
    const family = await service.createFamily({ locale: 'en' });
    const keepFamily = await service.createFamily({ locale: 'en' });
    const a = await service.createChild(family.id, {
      nickname: 'A',
      ...bornMonthsAgo(24),
      languages: ['English'],
    });
    const b = await service.createChild(family.id, {
      nickname: 'B',
      ...bornMonthsAgo(50),
      languages: ['English'],
    });
    const kept = await service.createChild(keepFamily.id, {
      nickname: 'Kept',
      ...bornMonthsAgo(24),
      languages: ['English'],
    });

    const purged: string[] = [];
    repository.onDeleteChildren = async (ids) => {
      purged.push(...ids);
    };
    await service.deleteFamily(family.id);

    expect(purged.sort()).toEqual([a.id, b.id].sort());
    expect(purged).not.toContain(kept.id);
    // The other family is untouched.
    expect((await service.getFamily(keepFamily.id)).id).toBe(keepFamily.id);
    expect((await service.getChild(keepFamily.id, kept.id)).id).toBe(kept.id);
  });

  it('deleting an unknown family is a clear 404', async () => {
    await expect(service.deleteFamily('unknown-family')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('families — account recovery on a new device (issue #23)', () => {
  let service: FamiliesService;

  beforeEach(async () => {
    ({ service } = await buildService());
  });

  it('a guest (no requestingUserId) always gets a brand-new, unowned family', async () => {
    const first = await service.createFamily({ locale: 'en' });
    const second = await service.createFamily({ locale: 'en' });
    expect(first.id).not.toBe(second.id);
  });

  it('a logged-in account calling createFamily twice gets the SAME family back, not a duplicate', async () => {
    const first = await service.createFamily({ locale: 'en' }, 'user-1');
    const second = await service.createFamily({ locale: 'en' }, 'user-1');
    expect(second.id).toBe(first.id);
  });

  it('two different accounts never share a family even if they call createFamily independently', async () => {
    const familyA = await service.createFamily({ locale: 'en' }, 'user-1');
    const familyB = await service.createFamily({ locale: 'en' }, 'user-2');
    expect(familyA.id).not.toBe(familyB.id);
  });

  it('getChildren lists every child recorded under a family', async () => {
    const family = await service.createFamily({ locale: 'en' });
    const a = await service.createChild(family.id, {
      nickname: 'A',
      ...bornMonthsAgo(24),
      languages: ['English'],
    });
    const b = await service.createChild(family.id, {
      nickname: 'B',
      ...bornMonthsAgo(50),
      languages: ['English'],
    });

    const children = await service.getChildren(family.id);
    expect(children.map((c) => c.id).sort()).toEqual([a.id, b.id].sort());
  });

  it('getChildren on an unknown family is a clear 404, not an empty list', async () => {
    await expect(service.getChildren('unknown-family')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
