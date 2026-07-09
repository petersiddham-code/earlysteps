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

  // Sized to clear the minimum-evidence floors (issue #22): >=3 scored answers per domain
  // present and >=10 overall, so this stays the "results actually shown" happy path.
  const reassuringBatch = [
    r('T1', 'before_12mo'),
    r('T2', 'short_sentences'),
    r('T3', 'yes_often'),
    r('T4', 'looks_right_away'),
    r('T5', 'almost_always'),
    r('T6', 'yes_often'),
    r('T7', 'yes_usually'),
    r('T12', 'no'),
    r('T13', 'no'),
    r('T14', 'wide_variety'),
  ];

  it('low-signal case: reassuring answers produce all-low domains and begin-now tier', async () => {
    const responses = reassuringBatch.map((res) => ({ ...res, child_id: childId }));

    const view = await service.submitIntakeResponses(childId, responses);

    expect(view.disclaimer).toBe(SCREENING_DISCLAIMER);
    expect(view.domains.length).toBeGreaterThan(0);
    expect(
      view.domains.every(
        (d) => d.status === 'scored' && d.label === 'Low signs observed',
      ),
    ).toBe(true);
    expect(view.redFlagTypes).toEqual([]);
    expect(view.recommendationTier).toBe('Support activities can begin now');
    // Issue #64: no red flags, so the recommendation's confidence is the support
    // estimate's own confidence — never left blank.
    expect(view.recommendationConfidence).not.toBeNull();
    expect(view.insufficientEvidenceOverall).toBe(false);
    // Provenance (issue #22): the view says what it rests on.
    expect(view.basedOnAnswers).toBe(reassuringBatch.length);
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
    // Issue #64: a red-flag-forced recommendation is always high confidence.
    expect(view.recommendationConfidence).toBe('high');
    const social = view.domains.find((d) => d.domain === 'social');
    // 3 answers in the social domain — at the per-domain floor, so the level shows.
    expect(social).toMatchObject({ status: 'scored', label: 'Many signs observed' });
  });

  it('urgent red-flag case: self-injury risk escalates to strongly-recommended-soon even as the ONLY answer (gate-exempt)', async () => {
    const responses = [{ ...r('RF_self_injury', 'yes'), child_id: childId }];

    const view = await service.submitIntakeResponses(childId, responses);

    // One answer is far below every evidence floor (issue #22)…
    expect(view.insufficientEvidenceOverall).toBe(true);
    expect(view.supportLevel).toBeNull();
    // …but red flags are EXEMPT (CLAUDE.md §2 rule 8): the flag surfaces and forces a tier.
    expect(view.redFlagTypes).toContain('self_injury_risk');
    expect(view.recommendationTier).toBe('Formal assessment strongly recommended soon');
    // Issue #64: still high confidence even though the overall evidence floor was
    // never met — the red flag alone earns it, not diluted by thin domain evidence.
    expect(view.recommendationConfidence).toBe('high');
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

  it('stamps each snapshot with the age band the screening used — trend history (#25)', async () => {
    await service.submitIntakeResponses(childId, [
      { ...r('T1', 'before_12mo'), child_id: childId },
    ]);

    const snapshot = await repository.getLatestSnapshot(childId);
    // The seeded child is 24 months old — squarely toddler. The band is derived from
    // birth month/year at compute time and recorded on the snapshot, so later trend
    // graphs know which bank each screening drew from even after the child ages.
    expect(snapshot?.ageBand).toBe('toddler');
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

  describe('idempotent + serialized ingestion (issue #33)', () => {
    it('an exact replay of a submission inserts no duplicate rows and no extra snapshot', async () => {
      const batch = reassuringBatch.map((res) => ({ ...res, child_id: childId }));

      const first = await service.submitIntakeResponses(childId, batch);
      const replay = await service.submitIntakeResponses(childId, batch);

      // Same response body either way — a retrying client can't tell the difference…
      expect(replay).toEqual(first);
      // …but the history holds each answer exactly once, and no duplicate snapshot
      // was stamped (the replay skipped recompute entirely).
      expect(await repository.getIntakeResponses(childId)).toHaveLength(
        reassuringBatch.length,
      );
      expect(repository.snapshotCount(childId)).toBe(1);
    });

    it('five concurrent identical submissions collapse to one set of rows (issue #33 repro)', async () => {
      const batch = reassuringBatch.map((res) => ({ ...res, child_id: childId }));

      const views = await Promise.all(
        Array.from({ length: 5 }, () => service.submitIntakeResponses(childId, batch)),
      );

      expect(await repository.getIntakeResponses(childId)).toHaveLength(
        reassuringBatch.length,
      );
      // Every caller got a coherent view computed from the SAME single set of answers.
      for (const view of views) {
        expect(view.basedOnAnswers).toBe(reassuringBatch.length);
      }
    });

    it('concurrent DIFFERENT submissions serialize: the final snapshot reflects every answer', async () => {
      // Five distinct one-answer submissions racing — before the per-child lock, each
      // could read a partial history and the "latest" snapshot could miss answers.
      const batches = reassuringBatch
        .slice(0, 5)
        .map((res, i) => [
          { ...res, child_id: childId, timestamp: `2026-07-01T00:00:0${i}.000Z` },
        ]);

      await Promise.all(
        batches.map((batch) => service.submitIntakeResponses(childId, batch)),
      );

      expect(await repository.getIntakeResponses(childId)).toHaveLength(5);
      // The last snapshot in the serialized sequence saw the full history.
      const finalView = await service.getResults(childId);
      expect(finalView.basedOnAnswers).toBe(5);
      expect(repository.snapshotCount(childId)).toBe(5);
    });

    it('a genuine re-answer (fresh timestamp) still appends to history — never upserted away', async () => {
      await service.submitIntakeResponses(childId, [
        { ...r('T4', 'doesnt_notice'), child_id: childId },
      ]);
      await service.submitIntakeResponses(childId, [
        {
          ...r('T4', 'looks_right_away'),
          child_id: childId,
          timestamp: '2026-07-01T00:00:01.000Z',
        },
      ]);

      // Both answer events retained (raw history)…
      expect(await repository.getIntakeResponses(childId)).toHaveLength(2);
      // …while results count only the caregiver's current answer per question.
      const view = await service.getResults(childId);
      expect(view.basedOnAnswers).toBe(1);
    });

    it('a replay when no snapshot exists yet heals it by recomputing (crash-recovery path)', async () => {
      const batch = [{ ...r('T4', 'doesnt_notice'), child_id: childId }];
      // Simulate a crash after rows were saved but before the snapshot landed.
      await repository.saveIntakeResponses(childId, batch);
      expect(repository.snapshotCount(childId)).toBe(0);

      const view = await service.submitIntakeResponses(childId, batch);

      expect(repository.snapshotCount(childId)).toBe(1);
      expect(view.redFlagTypes).toContain('no_name_response');
      expect(await repository.getIntakeResponses(childId)).toHaveLength(1);
    });
  });

  describe('minimum-evidence gate (issue #22) — fail closed at the API boundary', () => {
    it('one answered question yields "not enough information yet", never a level or recommendation', async () => {
      const view = await service.submitIntakeResponses(childId, [
        { ...r('T4', 'after_few_tries'), child_id: childId },
      ]);

      expect(view.domains).toEqual([
        {
          domain: 'social',
          status: 'insufficient_evidence',
          label: 'Not enough information yet',
        },
      ]);
      expect(view.supportLevel).toBeNull();
      expect(view.recommendationTier).toBeNull();
      expect(view.recommendationConfidence).toBeNull();
      expect(view.insufficientEvidenceOverall).toBe(true);
      expect(view.basedOnAnswers).toBe(1);
      // The disclaimer still ships with the gated view (CLAUDE.md §2 rule 5).
      expect(view.disclaimer).toBe(SCREENING_DISCLAIMER);
    });

    it('a sparse domain surfaces once every question its band offers is answered (issue #52)', async () => {
      // The toddler band has only TWO repetitive-behaviour questions (T10, T11) against a
      // per-domain floor of 3. The service passes the band's real availability into the
      // engine, so answering both — with clearly concerning answers — must surface the
      // domain instead of leaving it "Not enough information yet" forever while a
      // similarly-answered richer domain (sensory, 4 questions) reports a level.
      const view = await service.submitIntakeResponses(childId, [
        ...reassuringBatch.map((response) => ({ ...response, child_id: childId })),
        { ...r('T10', ['hand_flapping', 'rocking']), child_id: childId },
        { ...r('T11', 'yes_a_lot'), child_id: childId },
      ]);

      const repetitive = view.domains.find((d) => d.domain === 'repetitive_behaviour');
      expect(repetitive).toMatchObject({
        status: 'scored',
        label: 'Some signs observed',
        // 2 answers can open the gate (it's all the band offers) but never raise
        // confidence past low — honesty about thin evidence stays intact.
        confidence: 'low',
      });
      // The richer sensory domain from the same batch also reports — no more
      // one-domain-gated / one-domain-scored inconsistency for equally-answered domains.
      const sensory = view.domains.find((d) => d.domain === 'sensory');
      expect(sensory?.status).toBe('scored');
    });

    it('a gated domain entry carries NO sign-level label or confidence key at all', async () => {
      const view = await service.submitIntakeResponses(childId, [
        { ...r('T4', 'doesnt_notice'), child_id: childId },
      ]);
      for (const domain of view.domains) {
        expect(domain.status).toBe('insufficient_evidence');
        expect(Object.keys(domain)).not.toContain('confidence');
        expect(domain.label).toBe('Not enough information yet');
      }
    });

    it('getResults inherits the gate and the provenance count (deduped, latest per question)', async () => {
      await service.submitIntakeResponses(childId, [
        { ...r('T4', 'doesnt_notice'), child_id: childId },
      ]);
      // Re-answering the same question must not inflate "Based on N answers". A genuine
      // re-answer carries a fresh timestamp (the client stamps at submit time) — an
      // identical timestamp would be an exact replay, skipped by the #33 idempotency key.
      await service.submitIntakeResponses(childId, [
        {
          ...r('T4', 'looks_right_away'),
          child_id: childId,
          timestamp: '2026-07-01T00:00:01.000Z',
        },
      ]);

      const view = await service.getResults(childId);
      expect(view.basedOnAnswers).toBe(1);
      expect(view.insufficientEvidenceOverall).toBe(true);
      expect(view.recommendationTier).toBeNull();
      expect(view.recommendationConfidence).toBeNull();
    });

    it('fails closed for snapshots computed before the gate existed (no sufficiency markers)', async () => {
      // Simulates a pre-#22 stored snapshot: findings without answered_count /
      // sufficient_evidence, plus a support estimate computed from a single answer.
      await repository.saveComputedSnapshot(childId, {
        profile: {
          child_id: childId,
          computed_at: AT,
          findings: [
            {
              domain: 'social',
              level: 'many',
              score: 80,
              confidence: 'low',
              evidence_refs: [],
            },
          ],
        },
        supportEstimate: {
          child_id: childId,
          level: 'moderate',
          confidence: 'low',
          computed_at: AT,
        },
        redFlags: [],
      });

      const view = await service.getResults(childId);
      expect(view.domains[0]).toMatchObject({ status: 'insufficient_evidence' });
      // The pre-gate estimate must never reach a caregiver.
      expect(view.supportLevel).toBeNull();
      expect(view.recommendationTier).toBeNull();
      expect(view.recommendationConfidence).toBeNull();
      expect(view.insufficientEvidenceOverall).toBe(true);
    });
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
