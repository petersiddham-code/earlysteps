/**
 * Integration test for the full intake -> scoring -> results pipeline (CLAUDE.md §10: "at
 * least one red-flag-triggering case and one low-signal case"). Runs against
 * InMemoryScreeningRepository and InMemoryFamiliesRepository (see the testing/ subfolder in
 * each module) — no live Postgres required.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { IntakeResponse } from '@earlysteps/shared-types';
import { SCREENING_DISCLAIMER } from '@earlysteps/shared-types';
import { ScreeningService } from '../src/screening/screening.service.js';
import { SCREENING_REPOSITORY } from '../src/screening/screening.repository.js';
import { InMemoryScreeningRepository } from '../src/screening/testing/in-memory-screening.repository.js';
import { FAMILIES_REPOSITORY } from '../src/families/families.repository.js';
import { InMemoryFamiliesRepository } from '../src/families/testing/in-memory-families.repository.js';

const AT = '2026-07-01T00:00:00.000Z';

function r(
  question_id: string,
  answer: IntakeResponse['answer'],
): Omit<IntakeResponse, 'child_id'> {
  return { question_id, domain: 'communication', answer, timestamp: AT };
}

async function buildService() {
  const repository = new InMemoryScreeningRepository();
  const familiesRepository = new InMemoryFamiliesRepository();
  const moduleRef = await Test.createTestingModule({
    providers: [
      ScreeningService,
      { provide: SCREENING_REPOSITORY, useValue: repository },
      { provide: FAMILIES_REPOSITORY, useValue: familiesRepository },
    ],
  }).compile();
  return { service: moduleRef.get(ScreeningService), repository, familiesRepository };
}

describe('screening pipeline — intake -> scoring -> results', () => {
  let service: ScreeningService;
  let repository: InMemoryScreeningRepository;
  let familiesRepository: InMemoryFamiliesRepository;
  let childId: string;

  beforeEach(async () => {
    ({ service, repository, familiesRepository } = await buildService());
    // Every existing scenario here tests the scoring pipeline, not consent — grant
    // data_storage up front so these tests exercise what they always exercised. The denial
    // path gets its own dedicated tests below.
    ({
      child: { id: childId },
    } = await familiesRepository.seedChildWithConsent(['data_storage']));
  });

  it('low-signal case: reassuring answers produce all-low domains and begin-now tier', async () => {
    const responses = [
      r('T1', 'before_12mo'),
      r('T4', 'looks_right_away'),
      r('T5', 'almost_always'),
      r('T6', 'yes_often'),
    ].map((res) => ({ ...res, child_id: childId }));

    const view = await service.submitIntakeResponses(childId, responses);

    expect(view.disclaimer).toBe(SCREENING_DISCLAIMER);
    expect(view.domains.length).toBeGreaterThan(0);
    expect(view.domains.every((d) => d.label === 'Low signs observed')).toBe(true);
    expect(view.redFlagTypes).toEqual([]);
    expect(view.recommendationTier).toBe('Support activities can begin now');
  });

  it('red-flag case: a concerning answer set surfaces a non-urgent red flag and recommends assessment', async () => {
    const responses = [
      r('T4', 'doesnt_notice'),
      r('T5', 'rarely'),
      r('T6', 'not_noticed'),
    ].map((res) => ({ ...res, child_id: childId }));

    const view = await service.submitIntakeResponses(childId, responses);

    expect(view.redFlagTypes).toContain('no_name_response');
    expect(view.recommendationTier).toBe('Formal assessment is recommended');
    const social = view.domains.find((d) => d.domain === 'social');
    expect(social?.label).toBe('Many signs observed');
  });

  it('urgent red-flag case: self-injury risk escalates to strongly-recommended-soon', async () => {
    const responses = [{ ...r('RF_self_injury', 'yes'), child_id: childId }];

    const view = await service.submitIntakeResponses(childId, responses);

    expect(view.redFlagTypes).toContain('self_injury_risk');
    expect(view.recommendationTier).toBe('Formal assessment strongly recommended soon');
  });

  it('never leaks a raw numeric score on any domain entry (product plan §4.4)', async () => {
    const responses = [{ ...r('T4', 'doesnt_notice'), child_id: childId }];

    const view = await service.submitIntakeResponses(childId, responses);

    for (const domain of view.domains) {
      expect(Object.keys(domain)).not.toContain('score');
    }
  });

  it('recomputes over the FULL answer history, not just the latest batch', async () => {
    await service.submitIntakeResponses(childId, [
      { ...r('T1', 'before_12mo'), child_id: childId },
    ]);
    // Second, separate submission — a red flag from the FIRST batch's domain shouldn't be
    // lost, and new evidence from this batch should combine with everything prior.
    const secondView = await service.submitIntakeResponses(childId, [
      { ...r('T4', 'doesnt_notice'), child_id: childId },
    ]);

    expect(secondView.redFlagTypes).toContain('no_name_response');
    expect(await repository.getIntakeResponses(childId)).toHaveLength(2);
  });

  it('retains history as an append-only sequence of snapshots (never overwritten)', async () => {
    await service.submitIntakeResponses(childId, [
      { ...r('T1', 'before_12mo'), child_id: childId },
    ]);
    await service.submitIntakeResponses(childId, [
      { ...r('T4', 'looks_right_away'), child_id: childId },
    ]);

    expect(repository.snapshotCount(childId)).toBe(2);
  });

  it('getResults returns the latest computed view without recomputing', async () => {
    await service.submitIntakeResponses(childId, [
      { ...r('T4', 'doesnt_notice'), child_id: childId },
    ]);

    const view = await service.getResults(childId);
    expect(view.redFlagTypes).toContain('no_name_response');
    expect(view.disclaimer).toBe(SCREENING_DISCLAIMER);
  });

  it('getResults throws NotFoundException for a child with no computed results', async () => {
    await expect(service.getResults('never-submitted')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('getIntakeResponses returns the full raw answer history, not just the latest batch', async () => {
    await service.submitIntakeResponses(childId, [
      { ...r('T1', 'before_12mo'), child_id: childId },
    ]);
    await service.submitIntakeResponses(childId, [
      { ...r('T4', 'looks_right_away'), child_id: childId },
    ]);

    const responses = await service.getIntakeResponses(childId);
    expect(responses.map((res) => res.question_id).sort()).toEqual(['T1', 'T4']);
  });

  it('getIntakeResponses returns an empty array for a child with no answers yet', async () => {
    expect(await service.getIntakeResponses('never-submitted')).toEqual([]);
  });
});

describe('screening pipeline — data_storage consent gate (CLAUDE.md §2 rule 9)', () => {
  it('refuses to persist intake responses without data_storage consent (fail-safe default)', async () => {
    const { service, familiesRepository } = await buildService();
    const { child } = await familiesRepository.seedChildWithConsent([]); // nothing granted

    await expect(
      service.submitIntakeResponses(child.id, [
        { ...r('T1', 'before_12mo'), child_id: child.id },
      ]),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses for a completely unknown child, not just an unconsented one', async () => {
    const { service } = await buildService();

    await expect(
      service.submitIntakeResponses('unknown-child', [
        { ...r('T1', 'before_12mo'), child_id: 'unknown-child' },
      ]),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not persist anything when consent is refused', async () => {
    const { service, repository, familiesRepository } = await buildService();
    const { child } = await familiesRepository.seedChildWithConsent([]);

    await expect(
      service.submitIntakeResponses(child.id, [
        { ...r('T1', 'before_12mo'), child_id: child.id },
      ]),
    ).rejects.toThrow();

    expect(await repository.getIntakeResponses(child.id)).toEqual([]);
  });

  it('succeeds once data_storage consent is granted for that family', async () => {
    const { service, familiesRepository } = await buildService();
    const { child } = await familiesRepository.seedChildWithConsent(['data_storage']);

    const view = await service.submitIntakeResponses(child.id, [
      { ...r('T1', 'before_12mo'), child_id: child.id },
    ]);
    expect(view.disclaimer).toBe(SCREENING_DISCLAIMER);
  });

  it('other consent scopes being granted does not substitute for data_storage', async () => {
    const { service, familiesRepository } = await buildService();
    const { child } = await familiesRepository.seedChildWithConsent([
      'ai_analysis',
      'media_capture',
      'professional_sharing',
    ]);

    await expect(
      service.submitIntakeResponses(child.id, [
        { ...r('T1', 'before_12mo'), child_id: child.id },
      ]),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
