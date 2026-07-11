/**
 * Integration tests for the independent AI results summary (issue #104).
 *
 * Covers the safety-critical paths the issue mandates:
 *  - consent-off: without ai_analysis consent the stage never runs, the LLM client is
 *    never invoked;
 *  - no answers yet: nothing to summarize, no LLM call, null result;
 *  - caching: an unchanged answer set reuses the cached narrative without calling the
 *    LLM again; a changed answer set triggers regeneration;
 *  - fail-closed schema validation: malformed model output yields null, nothing cached;
 *  - fail-closed content safety: banned words / reserved result labels anywhere in the
 *    model's output yield null, nothing cached.
 *
 * Runs against the in-memory repositories with a stubbed AiResultsSummaryClient — no
 * live Postgres and no live LLM.
 */
import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AnalysisService } from '../src/analysis/analysis.service.js';
import { ANALYSIS_REPOSITORY } from '../src/analysis/analysis.repository.js';
import {
  RESPONSE_ANALYSIS_CLIENT,
  DisabledResponseAnalysisClient,
} from '../src/analysis/analysis-client.js';
import {
  AI_RESULTS_SUMMARY_CLIENT,
  type AiResultsSummaryClient,
  type AiResultsSummaryInput,
} from '../src/analysis/ai-summary-client.js';
import { InMemoryAnalysisRepository } from '../src/analysis/testing/in-memory-analysis.repository.js';
import { ScreeningService } from '../src/screening/screening.service.js';
import { SCREENING_REPOSITORY } from '../src/screening/screening.repository.js';
import { InMemoryScreeningRepository } from '../src/screening/testing/in-memory-screening.repository.js';
import { FAMILIES_REPOSITORY } from '../src/families/families.repository.js';
import { InMemoryFamiliesRepository } from '../src/families/testing/in-memory-families.repository.js';

const AT = '2026-07-11T00:00:00.000Z';
const LATER = '2026-07-11T00:05:00.000Z';

const VALID_OUTPUT = JSON.stringify({
  overview: 'The answers describe a toddler who enjoys playing with others.',
  strengths: ['Enjoys back-and-forth play with familiar adults'],
  areas_to_watch: ['Limited spoken vocabulary for their age'],
  noted_by_caregiver: [],
});

/** Test double for the LLM: replays canned outputs and records every call it gets. */
class StubAiSummaryClient implements AiResultsSummaryClient {
  calls: AiResultsSummaryInput[] = [];
  constructor(private readonly outputs: (string | null)[]) {}
  async generateSummary(input: AiResultsSummaryInput): Promise<string | null> {
    this.calls.push(input);
    return this.outputs.length > 0 ? (this.outputs.shift() ?? null) : null;
  }
}

async function buildStack(clientOutputs: (string | null)[]) {
  const screeningRepository = new InMemoryScreeningRepository();
  const analysisRepository = new InMemoryAnalysisRepository(screeningRepository);
  const familiesRepository = new InMemoryFamiliesRepository();
  const aiSummaryClient = new StubAiSummaryClient(clientOutputs);
  const moduleRef = await Test.createTestingModule({
    providers: [
      ScreeningService,
      AnalysisService,
      { provide: SCREENING_REPOSITORY, useValue: screeningRepository },
      { provide: ANALYSIS_REPOSITORY, useValue: analysisRepository },
      { provide: FAMILIES_REPOSITORY, useValue: familiesRepository },
      {
        provide: RESPONSE_ANALYSIS_CLIENT,
        useValue: new DisabledResponseAnalysisClient(),
      },
      { provide: AI_RESULTS_SUMMARY_CLIENT, useValue: aiSummaryClient },
    ],
  }).compile();
  return {
    analysisService: moduleRef.get(AnalysisService),
    screeningService: moduleRef.get(ScreeningService),
    familiesRepository,
    analysisRepository,
    aiSummaryClient,
  };
}

describe('AI results summary — ai_analysis consent gate (issue #104)', () => {
  it('refuses to run without ai_analysis consent and never invokes the LLM client', async () => {
    const { analysisService, familiesRepository, aiSummaryClient } = await buildStack([
      VALID_OUTPUT,
    ]);
    const { child } = await familiesRepository.seedChildWithConsent(['data_storage']);

    await expect(analysisService.getResultsSummary(child.id)).rejects.toThrow(
      ForbiddenException,
    );
    expect(aiSummaryClient.calls).toHaveLength(0);
  });
});

describe('AI results summary — no answers yet (issue #104)', () => {
  it('returns null and never calls the LLM when nothing has been answered', async () => {
    const { analysisService, familiesRepository, aiSummaryClient } = await buildStack([
      VALID_OUTPUT,
    ]);
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'ai_analysis',
    ]);

    const result = await analysisService.getResultsSummary(child.id);

    expect(result).toBeNull();
    expect(aiSummaryClient.calls).toHaveLength(0);
  });
});

describe('AI results summary — caching (issue #104)', () => {
  it('reuses the cached narrative when the answered questions have not changed', async () => {
    const { analysisService, screeningService, familiesRepository, aiSummaryClient } =
      await buildStack([VALID_OUTPUT]);
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'ai_analysis',
    ]);
    await screeningService.submitIntakeResponses(child.id, [
      {
        child_id: child.id,
        question_id: 'T2',
        domain: 'communication',
        answer: 'few_1_5',
        timestamp: AT,
      },
    ]);

    const first = await analysisService.getResultsSummary(child.id);
    const second = await analysisService.getResultsSummary(child.id);

    expect(first).not.toBeNull();
    expect(second).toEqual(first);
    expect(aiSummaryClient.calls).toHaveLength(1);
  });

  it('regenerates when a new answer changes the answered-question set', async () => {
    const { analysisService, screeningService, familiesRepository, aiSummaryClient } =
      await buildStack([VALID_OUTPUT, VALID_OUTPUT]);
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'ai_analysis',
    ]);
    await screeningService.submitIntakeResponses(child.id, [
      {
        child_id: child.id,
        question_id: 'T2',
        domain: 'communication',
        answer: 'few_1_5',
        timestamp: AT,
      },
    ]);
    await analysisService.getResultsSummary(child.id);

    await screeningService.submitIntakeResponses(child.id, [
      {
        child_id: child.id,
        question_id: 'T3',
        domain: 'communication',
        answer: 'sometimes',
        timestamp: LATER,
      },
    ]);
    await analysisService.getResultsSummary(child.id);

    expect(aiSummaryClient.calls).toHaveLength(2);
  });
});

describe('AI results summary — fail closed (issue #104, CLAUDE.md §8)', () => {
  it('returns null and caches nothing for malformed model output', async () => {
    const { analysisService, screeningService, familiesRepository, aiSummaryClient } =
      await buildStack(['not json at all']);
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'ai_analysis',
    ]);
    await screeningService.submitIntakeResponses(child.id, [
      {
        child_id: child.id,
        question_id: 'T2',
        domain: 'communication',
        answer: 'few_1_5',
        timestamp: AT,
      },
    ]);

    const result = await analysisService.getResultsSummary(child.id);

    expect(result).toBeNull();
    expect(aiSummaryClient.calls).toHaveLength(1);
  });

  it('returns null when the model uses a reserved result label', async () => {
    const unsafeOutput = JSON.stringify({
      overview: 'Overall, Low signs observed across the answers given.',
      strengths: ['Enjoys play'],
      areas_to_watch: [],
      noted_by_caregiver: [],
    });
    const { analysisService, screeningService, familiesRepository } = await buildStack([
      unsafeOutput,
    ]);
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'ai_analysis',
    ]);
    await screeningService.submitIntakeResponses(child.id, [
      {
        child_id: child.id,
        question_id: 'T2',
        domain: 'communication',
        answer: 'few_1_5',
        timestamp: AT,
      },
    ]);

    const result = await analysisService.getResultsSummary(child.id);

    expect(result).toBeNull();
  });

  it('returns null when the model uses a banned word', async () => {
    const unsafeOutput = JSON.stringify({
      overview: 'The answers do not suggest anything abnormal.',
      strengths: ['Enjoys play'],
      areas_to_watch: [],
      noted_by_caregiver: [],
    });
    const { analysisService, screeningService, familiesRepository } = await buildStack([
      unsafeOutput,
    ]);
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'ai_analysis',
    ]);
    await screeningService.submitIntakeResponses(child.id, [
      {
        child_id: child.id,
        question_id: 'T2',
        domain: 'communication',
        answer: 'few_1_5',
        timestamp: AT,
      },
    ]);

    const result = await analysisService.getResultsSummary(child.id);

    expect(result).toBeNull();
  });

  // QA on PR #105 found the model can suggest seeing a professional in soft language
  // ("worth discussing with a healthcare provider") without ever using a reserved label —
  // that reads as a second, competing recommendation just as much as the reserved phrases.
  it('returns null when the model suggests professional follow-up in its own words', async () => {
    const unsafeOutput = JSON.stringify({
      overview: 'The answers describe a toddler who enjoys playing with others.',
      strengths: ['Enjoys play'],
      areas_to_watch: [
        'This detail deserves follow-up with a professional, worth discussing with a healthcare provider.',
      ],
      noted_by_caregiver: [],
    });
    const { analysisService, screeningService, familiesRepository } = await buildStack([
      unsafeOutput,
    ]);
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'ai_analysis',
    ]);
    await screeningService.submitIntakeResponses(child.id, [
      {
        child_id: child.id,
        question_id: 'T2',
        domain: 'communication',
        answer: 'few_1_5',
        timestamp: AT,
      },
    ]);

    const result = await analysisService.getResultsSummary(child.id);

    expect(result).toBeNull();
  });

  it('returns null when the LLM client is unavailable (no API key / transport failure)', async () => {
    const { analysisService, screeningService, familiesRepository } = await buildStack([
      null,
    ]);
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'ai_analysis',
    ]);
    await screeningService.submitIntakeResponses(child.id, [
      {
        child_id: child.id,
        question_id: 'T2',
        domain: 'communication',
        answer: 'few_1_5',
        timestamp: AT,
      },
    ]);

    const result = await analysisService.getResultsSummary(child.id);

    expect(result).toBeNull();
  });

  // A narrative cached before a content-safety rule existed (or was tightened) must not
  // keep serving unsafe content forever just because the answers it was built from
  // haven't changed since — PR #105 QA prompted the professional-referral rule above.
  it('discards and regenerates a previously cached narrative that is unsafe under current rules', async () => {
    const {
      analysisService,
      screeningService,
      familiesRepository,
      analysisRepository,
      aiSummaryClient,
    } = await buildStack([VALID_OUTPUT, VALID_OUTPUT]);
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'ai_analysis',
    ]);
    await screeningService.submitIntakeResponses(child.id, [
      {
        child_id: child.id,
        question_id: 'T2',
        domain: 'communication',
        answer: 'few_1_5',
        timestamp: AT,
      },
    ]);

    const generated = await analysisService.getResultsSummary(child.id);
    expect(generated).not.toBeNull();

    // Simulate a narrative that was cached under an older, weaker safety check: same
    // content hash (the answers haven't changed), but text that today's rules reject.
    const cached = await analysisRepository.getCachedAiSummary(child.id);
    await analysisRepository.saveAiSummary(child.id, cached!.contentHash, {
      ...cached!.content,
      overview: 'This is worth discussing with a healthcare provider.',
    });

    const result = await analysisService.getResultsSummary(child.id);

    expect(result).not.toBeNull();
    expect(result?.overview).not.toContain('healthcare provider');
    expect(aiSummaryClient.calls).toHaveLength(2);
  });
});
