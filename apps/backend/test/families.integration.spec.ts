/**
 * Integration test for family/child onboarding and layered consent (product plan §4.7,
 * CLAUDE.md §2 rule 9). Runs against InMemoryFamiliesRepository — no live Postgres required.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { FamiliesService } from '../src/families/families.service.js';
import { FAMILIES_REPOSITORY } from '../src/families/families.repository.js';
import { InMemoryFamiliesRepository } from '../src/families/testing/in-memory-families.repository.js';

async function buildService() {
  const repository = new InMemoryFamiliesRepository();
  const moduleRef = await Test.createTestingModule({
    providers: [FamiliesService, { provide: FAMILIES_REPOSITORY, useValue: repository }],
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
      ageBand: 'toddler',
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
      ageBand: 'toddler',
      languages: ['English'],
    });
    await expect(service.getChild(family.id, child.id)).resolves.toMatchObject({
      id: child.id,
      family_id: family.id,
    });
  });

  it("refuses to serve a child under a different family's path (tenancy, same 404 as missing)", async () => {
    const familyA = await service.createFamily({ locale: 'en' });
    const familyB = await service.createFamily({ locale: 'en' });
    const child = await service.createChild(familyA.id, {
      nickname: 'Alex',
      ageBand: 'toddler',
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
