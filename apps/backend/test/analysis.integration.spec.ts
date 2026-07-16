/**
 * Integration tests for the free-text response-analysis stage (issue #26).
 *
 * Covers the safety-critical paths the issue mandates:
 *  - consent-off: without ai_analysis consent the stage never runs, the LLM client is
 *    never invoked, and deterministic results still work;
 *  - schema-validation failures: malformed model output contributes nothing (fail closed);
 *  - the red-flag fixture: free text describing loss of skills -> suggestion ->
 *    caregiver confirms 'yes' -> the deterministic red-flag rule actually fires.
 *
 * Runs against the in-memory repositories with a stubbed ResponseAnalysisClient — no
 * live Postgres and no live LLM (the client port is exactly what production swaps in).
 */
import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { makeFreeTextAnswer, type IntakeResponse } from '@earlysteps/shared-types';
import { AnalysisService } from '../src/analysis/analysis.service.js';
import { ANALYSIS_REPOSITORY } from '../src/analysis/analysis.repository.js';
import {
  RESPONSE_ANALYSIS_CLIENT,
  type FreeTextAnalysisInput,
  type ResponseAnalysisClient,
} from '../src/analysis/analysis-client.js';
import { InMemoryAnalysisRepository } from '../src/analysis/testing/in-memory-analysis.repository.js';
import {
  AI_RESULTS_SUMMARY_CLIENT,
  DisabledAiResultsSummaryClient,
} from '../src/analysis/ai-summary-client.js';
import { ScreeningService } from '../src/screening/screening.service.js';
import { SCREENING_REPOSITORY } from '../src/screening/screening.repository.js';
import { InMemoryScreeningRepository } from '../src/screening/testing/in-memory-screening.repository.js';
import { FAMILIES_REPOSITORY } from '../src/families/families.repository.js';
import { InMemoryFamiliesRepository } from '../src/families/testing/in-memory-families.repository.js';
import { MediaService } from '../src/media/media.service.js';
import { MediaEncryptionService } from '../src/media/media-encryption.service.js';
import { MEDIA_REPOSITORY } from '../src/media/media.repository.js';
import { InMemoryMediaRepository } from '../src/media/testing/in-memory-media.repository.js';
import { OBJECT_STORAGE_SERVICE } from '../src/media/object-storage/object-storage.js';
import { InMemoryObjectStorageService } from '../src/media/testing/in-memory-object-storage.service.js';
import { FRAME_EXTRACTION_SERVICE } from '../src/media/frame-extraction.js';
import { FakeFrameExtractionService } from '../src/media/testing/fake-frame-extraction.service.js';

const AT = '2026-07-02T00:00:00.000Z';

/** Test double for the LLM: replays canned outputs and records every call it gets. */
class StubAnalysisClient implements ResponseAnalysisClient {
  calls: FreeTextAnalysisInput[] = [];
  constructor(private readonly outputs: (string | null)[]) {}
  async analyzeFreeText(input: FreeTextAnalysisInput): Promise<string | null> {
    this.calls.push(input);
    return this.outputs.length > 0 ? (this.outputs.shift() ?? null) : null;
  }
}

function freeTextResponse(
  childId: string,
  questionId: string,
  text: string,
): IntakeResponse {
  return {
    child_id: childId,
    question_id: questionId,
    domain: 'communication',
    answer: [makeFreeTextAnswer(text)],
    timestamp: AT,
  };
}

const LOSS_OF_SKILLS_OUTPUT = JSON.stringify({
  signals: [
    {
      red_flag_type: 'loss_of_skills',
      domain: 'communication',
      salience: 'high',
      evidence_quote: 'he stopped speaking last month',
    },
  ],
});

async function buildStack(clientOutputs: (string | null)[]) {
  const screeningRepository = new InMemoryScreeningRepository();
  const analysisRepository = new InMemoryAnalysisRepository(screeningRepository);
  const familiesRepository = new InMemoryFamiliesRepository();
  const client = new StubAnalysisClient(clientOutputs);
  const moduleRef = await Test.createTestingModule({
    providers: [
      ScreeningService,
      AnalysisService,
      { provide: SCREENING_REPOSITORY, useValue: screeningRepository },
      { provide: ANALYSIS_REPOSITORY, useValue: analysisRepository },
      { provide: FAMILIES_REPOSITORY, useValue: familiesRepository },
      { provide: RESPONSE_ANALYSIS_CLIENT, useValue: client },
      // Not under test here (issue #104) — this stage is unaffected by response analysis.
      {
        provide: AI_RESULTS_SUMMARY_CLIENT,
        useValue: new DisabledAiResultsSummaryClient(),
      },
      // Not under test here (issue #135/#139) — no child ever has media in this file's
      // fixtures, so MediaService's photo/video-frame evidence is always [] and never observed.
      MediaService,
      MediaEncryptionService,
      { provide: MEDIA_REPOSITORY, useClass: InMemoryMediaRepository },
      { provide: OBJECT_STORAGE_SERVICE, useClass: InMemoryObjectStorageService },
      { provide: FRAME_EXTRACTION_SERVICE, useClass: FakeFrameExtractionService },
    ],
  }).compile();
  return {
    analysisService: moduleRef.get(AnalysisService),
    screeningService: moduleRef.get(ScreeningService),
    familiesRepository,
    client,
  };
}

describe('response analysis — ai_analysis consent gate (issue #26, product plan §4.7)', () => {
  it('refuses to run without ai_analysis consent and never invokes the LLM client', async () => {
    const { analysisService, screeningService, familiesRepository, client } =
      await buildStack([LOSS_OF_SKILLS_OUTPUT]);
    const { child } = await familiesRepository.seedChildWithConsent(['data_storage']);
    await screeningService.submitIntakeResponses(child.id, [
      freeTextResponse(child.id, 'T2', 'he stopped speaking last month'),
    ]);

    await expect(analysisService.runAnalysis(child.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(client.calls).toEqual([]);
  });

  it('gates reads too, and data_storage consent alone does not substitute', async () => {
    const { analysisService, familiesRepository, client } = await buildStack([]);
    const { child } = await familiesRepository.seedChildWithConsent(['data_storage']);

    await expect(analysisService.getPendingSuggestions(child.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(client.calls).toEqual([]);
  });

  it('consent off -> deterministic results still work end to end', async () => {
    const { analysisService, screeningService, familiesRepository } = await buildStack([
      LOSS_OF_SKILLS_OUTPUT,
    ]);
    const { child } = await familiesRepository.seedChildWithConsent(['data_storage']);

    const view = await screeningService.submitIntakeResponses(child.id, [
      freeTextResponse(child.id, 'T2', 'he stopped speaking last month'),
    ]);

    // The typed text alone changes nothing deterministic — and analysis being
    // unavailable (no consent) doesn't block the results view.
    expect(view.redFlagTypes).toEqual([]);
    expect(view.disclaimer).toBeTruthy();
    await expect(analysisService.runAnalysis(child.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect((await screeningService.getResults(child.id)).redFlagTypes).toEqual([]);
  });
});

describe('response analysis — schema-validation failure paths (fail closed, CLAUDE.md §8)', () => {
  const MALFORMED_OUTPUTS: [string, string][] = [
    ['non-JSON prose', 'The caregiver seems worried about speech regression.'],
    ['truncated JSON', '{"signals": [{"red_flag_type": "loss_of_skills"'],
    [
      'off-enum red flag type',
      JSON.stringify({
        signals: [
          {
            red_flag_type: 'autism_diagnosis',
            domain: 'communication',
            salience: 'high',
            evidence_quote: 'x',
          },
        ],
      }),
    ],
    [
      'off-enum salience',
      JSON.stringify({
        signals: [
          {
            red_flag_type: 'loss_of_skills',
            domain: 'communication',
            salience: 'urgent',
            evidence_quote: 'x',
          },
        ],
      }),
    ],
    [
      'oversized signals array',
      JSON.stringify({
        signals: Array.from({ length: 10 }, () => ({
          red_flag_type: 'loss_of_skills',
          domain: null,
          salience: 'high',
          evidence_quote: 'x',
        })),
      }),
    ],
    ['wrong shape entirely', JSON.stringify({ verdict: 'child has a condition' })],
  ];

  it.each(MALFORMED_OUTPUTS)(
    '%s -> no suggestions, no throw, results unaffected',
    async (_label, output) => {
      const { analysisService, screeningService, familiesRepository } = await buildStack([
        output,
      ]);
      const { child } = await familiesRepository.seedChildWithConsent([
        'data_storage',
        'ai_analysis',
      ]);
      await screeningService.submitIntakeResponses(child.id, [
        freeTextResponse(child.id, 'T2', 'he stopped speaking last month'),
      ]);

      const suggestions = await analysisService.runAnalysis(child.id);

      expect(suggestions).toEqual([]);
      expect((await screeningService.getResults(child.id)).redFlagTypes).toEqual([]);
    },
  );

  it('a client failure (null) leaves the response unanalyzed for a later retry', async () => {
    const { analysisService, familiesRepository, screeningService, client } =
      await buildStack([null, LOSS_OF_SKILLS_OUTPUT]);
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'ai_analysis',
    ]);
    await screeningService.submitIntakeResponses(child.id, [
      freeTextResponse(child.id, 'T2', 'he stopped speaking last month'),
    ]);

    expect(await analysisService.runAnalysis(child.id)).toEqual([]);
    // Second run retries the same text and now succeeds.
    const suggestions = await analysisService.runAnalysis(child.id);
    expect(suggestions).toHaveLength(1);
    expect(client.calls).toHaveLength(2);
  });

  it('malformed output still counts as analyzed — the same text is not re-sent', async () => {
    const { analysisService, familiesRepository, screeningService, client } =
      await buildStack(['not json', LOSS_OF_SKILLS_OUTPUT]);
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'ai_analysis',
    ]);
    await screeningService.submitIntakeResponses(child.id, [
      freeTextResponse(child.id, 'T2', 'he stopped speaking last month'),
    ]);

    await analysisService.runAnalysis(child.id);
    await analysisService.runAnalysis(child.id);
    expect(client.calls).toHaveLength(1);
  });
});

describe('response analysis — red-flag fixture: free text -> confirmation -> flag fires', () => {
  it('the full loop: typed regression note -> follow-up -> yes -> loss_of_skills red flag', async () => {
    const { analysisService, screeningService, familiesRepository, client } =
      await buildStack([LOSS_OF_SKILLS_OUTPUT]);
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'ai_analysis',
    ]);

    // 1. Caregiver types the note; deterministic pass sees nothing (free text weighs 0).
    const initialView = await screeningService.submitIntakeResponses(child.id, [
      freeTextResponse(child.id, 'T2', 'he stopped speaking last month'),
    ]);
    expect(initialView.redFlagTypes).toEqual([]);

    // 2. Analysis proposes the content-authored confirmation follow-up.
    const suggestions = await analysisService.runAnalysis(child.id);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      follow_up_id: 'FU_loss_of_skills',
      red_flag_type: 'loss_of_skills',
      source_question_id: 'T2',
      source_quote: 'he stopped speaking last month',
    });
    // The question shown is the content-authored wording, with a hint (CLAUDE.md §5).
    expect(suggestions[0]!.text.length).toBeGreaterThan(0);
    expect(suggestions[0]!.hint.length).toBeGreaterThan(0);

    // Issue #102: source_quote is the model's own short extracted fragment, not the
    // caregiver's full typed note, so several suggestions can render together on one
    // compact screen. This fixture's note and evidence_quote happen to be identical
    // strings, so the next test proves the distinction with a longer note.

    // 3. The caregiver confirms — and only then does the deterministic rule fire.
    const view = await analysisService.answerSuggestion(
      child.id,
      suggestions[0]!.id,
      'yes',
    );
    expect(view.redFlagTypes).toContain('loss_of_skills');
    expect(view.recommendationTier).toBe('Formal assessment is recommended');

    // The confirmation went through the normal pipeline as a real IntakeResponse.
    const responses = await screeningService.getIntakeResponses(child.id);
    expect(responses.map((r) => r.question_id)).toContain('FU_loss_of_skills');

    // Answered — no longer pending; the persisted results agree.
    expect(await analysisService.getPendingSuggestions(child.id)).toEqual([]);
    expect((await screeningService.getResults(child.id)).redFlagTypes).toContain(
      'loss_of_skills',
    );

    // PII minimization: the LLM saw only question text + the single typed answer.
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]).toEqual({
      questionText: expect.any(String),
      freeText: 'he stopped speaking last month',
    });
    expect(client.calls[0]!.questionText).not.toContain('Test Child');
  });

  it("answering 'no' records the answer but fires no red flag", async () => {
    const { analysisService, screeningService, familiesRepository } = await buildStack([
      LOSS_OF_SKILLS_OUTPUT,
    ]);
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'ai_analysis',
    ]);
    await screeningService.submitIntakeResponses(child.id, [
      freeTextResponse(child.id, 'T2', 'he stopped speaking last month'),
    ]);

    const [suggestion] = await analysisService.runAnalysis(child.id);
    const view = await analysisService.answerSuggestion(child.id, suggestion!.id, 'no');

    expect(view.redFlagTypes).toEqual([]);
    expect(await analysisService.getPendingSuggestions(child.id)).toEqual([]);
  });

  it("answering 'not_sure' also fires nothing — uncertainty is never a trap", async () => {
    const { analysisService, screeningService, familiesRepository } = await buildStack([
      LOSS_OF_SKILLS_OUTPUT,
    ]);
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'ai_analysis',
    ]);
    await screeningService.submitIntakeResponses(child.id, [
      freeTextResponse(child.id, 'T2', 'he stopped speaking last month'),
    ]);

    const [suggestion] = await analysisService.runAnalysis(child.id);
    const view = await analysisService.answerSuggestion(
      child.id,
      suggestion!.id,
      'not_sure',
    );
    expect(view.redFlagTypes).toEqual([]);
  });

  it('the same follow-up is suggested at most once per child, even across repeat mentions', async () => {
    const { analysisService, screeningService, familiesRepository } = await buildStack([
      LOSS_OF_SKILLS_OUTPUT,
      LOSS_OF_SKILLS_OUTPUT,
    ]);
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'ai_analysis',
    ]);
    await screeningService.submitIntakeResponses(child.id, [
      freeTextResponse(child.id, 'T2', 'he stopped speaking last month'),
    ]);
    const first = await analysisService.runAnalysis(child.id);
    expect(first).toHaveLength(1);
    await analysisService.answerSuggestion(child.id, first[0]!.id, 'no');

    // A second note describing the same signal must not re-open the question.
    await screeningService.submitIntakeResponses(child.id, [
      freeTextResponse(child.id, 'T12', 'he lost more words this week'),
    ]);
    expect(await analysisService.runAnalysis(child.id)).toEqual([]);
  });

  it('domain-only signals (no red_flag_type) create no follow-up in this iteration', async () => {
    const output = JSON.stringify({
      signals: [
        {
          red_flag_type: null,
          domain: 'sensory',
          salience: 'medium',
          evidence_quote: 'covers his ears at the market',
        },
      ],
    });
    const { analysisService, screeningService, familiesRepository } = await buildStack([
      output,
    ]);
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'ai_analysis',
    ]);
    await screeningService.submitIntakeResponses(child.id, [
      freeTextResponse(child.id, 'T12', 'covers his ears at the market'),
    ]);

    expect(await analysisService.runAnalysis(child.id)).toEqual([]);
  });

  it('answering an unknown or already-answered suggestion is a 404, not a crash', async () => {
    const { analysisService, screeningService, familiesRepository } = await buildStack([
      LOSS_OF_SKILLS_OUTPUT,
    ]);
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'ai_analysis',
    ]);
    await screeningService.submitIntakeResponses(child.id, [
      freeTextResponse(child.id, 'T2', 'he stopped speaking last month'),
    ]);
    const [suggestion] = await analysisService.runAnalysis(child.id);

    await expect(
      analysisService.answerSuggestion(child.id, 'no-such-id', 'yes'),
    ).rejects.toBeInstanceOf(NotFoundException);

    await analysisService.answerSuggestion(child.id, suggestion!.id, 'yes');
    await expect(
      analysisService.answerSuggestion(child.id, suggestion!.id, 'yes'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('a child with no free-text answers triggers no LLM calls at all', async () => {
    const { analysisService, screeningService, familiesRepository, client } =
      await buildStack([LOSS_OF_SKILLS_OUTPUT]);
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'ai_analysis',
    ]);
    await screeningService.submitIntakeResponses(child.id, [
      {
        child_id: child.id,
        question_id: 'T4',
        domain: 'social',
        answer: 'looks_right_away',
        timestamp: AT,
      },
    ]);

    expect(await analysisService.runAnalysis(child.id)).toEqual([]);
    expect(client.calls).toEqual([]);
  });

  it("source_quote is the model's short evidence_quote, not the caregiver's full note (issue #102)", async () => {
    const longNote =
      'He used to say about ten words and wave bye-bye, but over the last month he ' +
      'stopped speaking almost entirely and does not respond when we call his name ' +
      'either, which is very different from how he was over the summer.';
    const output = JSON.stringify({
      signals: [
        {
          red_flag_type: 'loss_of_skills',
          domain: 'communication',
          salience: 'high',
          evidence_quote: 'stopped speaking almost entirely',
        },
      ],
    });
    const { analysisService, screeningService, familiesRepository } = await buildStack([
      output,
    ]);
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'ai_analysis',
    ]);
    await screeningService.submitIntakeResponses(child.id, [
      freeTextResponse(child.id, 'T2', longNote),
    ]);

    const [suggestion] = await analysisService.runAnalysis(child.id);
    expect(suggestion!.source_quote).toBe('stopped speaking almost entirely');
    expect(suggestion!.source_quote).not.toBe(longNote);
  });
});
