/**
 * Integration test for the full intake -> scoring -> results pipeline (CLAUDE.md §10: "at
 * least one red-flag-triggering case and one low-signal case"). Runs against
 * InMemoryScreeningRepository (see src/screening/testing/) — no live Postgres required.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import type { IntakeResponse } from '@earlysteps/shared-types';
import { SCREENING_DISCLAIMER } from '@earlysteps/shared-types';
import { ScreeningService } from '../src/screening/screening.service.js';
import { SCREENING_REPOSITORY } from '../src/screening/screening.repository.js';
import { InMemoryScreeningRepository } from '../src/screening/testing/in-memory-screening.repository.js';

const AT = '2026-07-01T00:00:00.000Z';

function r(
  question_id: string,
  answer: IntakeResponse['answer'],
): Omit<IntakeResponse, 'child_id'> {
  return { question_id, domain: 'communication', answer, timestamp: AT };
}

async function buildService() {
  const repository = new InMemoryScreeningRepository();
  const moduleRef = await Test.createTestingModule({
    providers: [
      ScreeningService,
      { provide: SCREENING_REPOSITORY, useValue: repository },
    ],
  }).compile();
  return { service: moduleRef.get(ScreeningService), repository };
}

describe('screening pipeline — intake -> scoring -> results', () => {
  let service: ScreeningService;
  let repository: InMemoryScreeningRepository;

  beforeEach(async () => {
    ({ service, repository } = await buildService());
  });

  it('low-signal case: reassuring answers produce all-low domains and begin-now tier', async () => {
    const childId = 'child-reassuring';
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
    const childId = 'child-concerning';
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
    const childId = 'child-urgent';
    const responses = [{ ...r('RF_self_injury', 'yes'), child_id: childId }];

    const view = await service.submitIntakeResponses(childId, responses);

    expect(view.redFlagTypes).toContain('self_injury_risk');
    expect(view.recommendationTier).toBe('Formal assessment strongly recommended soon');
  });

  it('never leaks a raw numeric score on any domain entry (product plan §4.4)', async () => {
    const childId = 'child-no-score-leak';
    const responses = [{ ...r('T4', 'doesnt_notice'), child_id: childId }];

    const view = await service.submitIntakeResponses(childId, responses);

    for (const domain of view.domains) {
      expect(Object.keys(domain)).not.toContain('score');
    }
  });

  it('recomputes over the FULL answer history, not just the latest batch', async () => {
    const childId = 'child-cumulative';
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
    const childId = 'child-history';
    await service.submitIntakeResponses(childId, [
      { ...r('T1', 'before_12mo'), child_id: childId },
    ]);
    await service.submitIntakeResponses(childId, [
      { ...r('T4', 'looks_right_away'), child_id: childId },
    ]);

    expect(repository.snapshotCount(childId)).toBe(2);
  });

  it('getResults returns the latest computed view without recomputing', async () => {
    const childId = 'child-get-results';
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
});
