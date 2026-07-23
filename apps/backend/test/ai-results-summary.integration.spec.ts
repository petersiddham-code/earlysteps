/**
 * Integration tests for the independent AI results summary / Assessment B (issue #104,
 * dual-assessment update 2026-07-11, CLAUDE.md §13/§14).
 *
 * Covers the safety-critical paths the issue mandates:
 *  - consent-off: without ai_analysis consent the stage never runs, the LLM client is
 *    never invoked;
 *  - no answers yet: nothing to summarize, no LLM call, null result;
 *  - caching: an unchanged answer set reuses the cached narrative without calling the
 *    LLM again; a changed answer set triggers regeneration;
 *  - fail-closed schema validation: malformed model output yields null, nothing cached;
 *  - fail-closed content safety: banned words / reserved result labels anywhere in the
 *    model's output yield null, nothing cached, EXCEPT the documented
 *    professionalAssessmentPriorities carve-out;
 *  - the Comparison Section (§13/§14): agreement / partial agreement / disagreement,
 *    computed AFTER both Assessment A and Assessment B have independently produced their
 *    own output, and the red-flag safety note that always survives regardless of status.
 *
 * Runs against the in-memory repositories with a stubbed AiResultsSummaryClient — no
 * live Postgres and no live LLM.
 */
import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import type { IntakeResponse } from '@earlysteps/shared-types';
import { AnalysisService } from '../src/analysis/analysis.service.js';
import {
  MAX_ANALYZABLE_AUDIO_CLIPS,
  MAX_ANALYZABLE_PHOTOS,
  MAX_ANALYZABLE_VIDEOS,
} from '../src/media/media.service.js';
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
import { MediaService } from '../src/media/media.service.js';
import { MediaEncryptionService } from '../src/media/media-encryption.service.js';
import { MEDIA_REPOSITORY } from '../src/media/media.repository.js';
import { InMemoryMediaRepository } from '../src/media/testing/in-memory-media.repository.js';
import {
  OBJECT_STORAGE_SERVICE,
  type ObjectStorageService,
} from '../src/media/object-storage/object-storage.js';
import { InMemoryObjectStorageService } from '../src/media/testing/in-memory-object-storage.service.js';
import { FRAME_EXTRACTION_SERVICE } from '../src/media/frame-extraction.js';
import { FakeFrameExtractionService } from '../src/media/testing/fake-frame-extraction.service.js';
import { AUDIO_TRANSCRIPTION_SERVICE } from '../src/media/audio-transcription.js';
import { FakeAudioTranscriptionService } from '../src/media/testing/fake-audio-transcription.service.js';

const AT = '2026-07-11T00:00:00.000Z';
const LATER = '2026-07-11T00:05:00.000Z';

/** Builds a v2 model-output fixture; override individual fields per test. */
function buildOutput(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    likelihood: 'Moderate',
    confidence: 'medium',
    reasoning: 'Several answers point toward reduced social reciprocity for their age.',
    developmental_profile:
      'The overall pattern suggests social-communication differences alongside typical play interests.',
    strengths: ['Enjoys back-and-forth play with familiar adults'],
    support_priorities: {
      immediate: [],
      short_term: [
        {
          priority: 'Shared picture-book time',
          reason: 'Builds on existing play enjoyment.',
        },
      ],
      medium_term: [],
      long_term: [],
    },
    uncertainty:
      'Only a few questions were answered this session, so this read is tentative.',
    uncertainty_factors: ['sparse_structured_answers'],
    evidence_summary:
      'The answers given lean toward limited spoken vocabulary for their age.',
    home_recommendations: ['Narrate daily routines out loud together'],
    school_recommendations: [],
    professional_assessment_priorities: [],
    ...overrides,
  });
}

const VALID_OUTPUT = buildOutput();

function r(
  question_id: string,
  answer: IntakeResponse['answer'],
  domain: IntakeResponse['domain'] = 'communication',
): Omit<IntakeResponse, 'child_id'> {
  return { question_id, domain, answer, timestamp: AT };
}

// Same fixture as screening.integration.spec.ts's "low-signal case": clears every
// evidence floor and yields recommendationTier 'Support activities can begin now' with no
// red flags — the deterministic "low" band this file's comparison tests build agreement/
// partial-agreement/disagreement fixtures against.
const REASSURING_BATCH = [
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
  const objectStorage = new InMemoryObjectStorageService();
  const frameExtraction = new FakeFrameExtractionService();
  const audioTranscription = new FakeAudioTranscriptionService();
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
      // issue #135/#139/#140: real MediaService (in-memory-backed) so photo/video/audio
      // evidence tests below can seed assets through the same upload path production uses,
      // consent gate included. FakeFrameExtractionService/FakeAudioTranscriptionService
      // stand in for real ffmpeg/OpenAI so these tests never decode a real video file or
      // call a real STT API.
      MediaService,
      MediaEncryptionService,
      { provide: MEDIA_REPOSITORY, useClass: InMemoryMediaRepository },
      { provide: OBJECT_STORAGE_SERVICE, useValue: objectStorage },
      { provide: FRAME_EXTRACTION_SERVICE, useValue: frameExtraction },
      { provide: AUDIO_TRANSCRIPTION_SERVICE, useValue: audioTranscription },
    ],
  }).compile();
  return {
    analysisService: moduleRef.get(AnalysisService),
    screeningService: moduleRef.get(ScreeningService),
    familiesRepository,
    analysisRepository,
    aiSummaryClient,
    mediaService: moduleRef.get(MediaService),
    objectStorage: moduleRef.get<ObjectStorageService>(OBJECT_STORAGE_SERVICE),
    frameExtraction,
    audioTranscription,
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

  // Live-verified 2026-07-12 (PR 2 browser check): a row cached under the pre-v2 shape
  // (overview/areasToWatch/notedByCaregiver, no supportPriorities) crashed the whole
  // request with an uncaught TypeError instead of failing closed, because
  // isSummaryStillSafe assumed every cached row already matched the current shape.
  it('treats a legacy-shaped (pre-v2) cached row as a cache miss and regenerates, instead of throwing', async () => {
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

    const first = await analysisService.getResultsSummary(child.id);
    expect(first).not.toBeNull();

    // Overwrite the cache (same content hash — the answers haven't changed) with a row
    // shaped like a pre-v2 (issue #104 v1) narrative: overview/strengths/areasToWatch/
    // notedByCaregiver, no likelihood/confidence/supportPriorities at all.
    const cached = await analysisRepository.getCachedAiSummary(child.id);
    const legacyShapedRow = {
      overview: 'The answers describe a toddler who enjoys playing with others.',
      strengths: ['Enjoys play'],
      areasToWatch: [],
      notedByCaregiver: [],
      generatedAt: AT,
    };
    await analysisRepository.saveAiSummary(
      child.id,
      cached!.contentHash,
      legacyShapedRow as never,
    );

    const result = await analysisService.getResultsSummary(child.id);

    expect(result).not.toBeNull();
    expect(result).toHaveProperty('likelihood');
    expect(aiSummaryClient.calls).toHaveLength(2);
  });
});

// Live-verified gap (2026-07-11, retest of PR #105 after Codex QA reported the AI
// assessment card intermittently never rendering): with v2's much larger free-text
// surface, a real generation occasionally drops one stray soft-referral phrase (observed:
// "...useful for future conversations with any professional" inside home_recommendations,
// well outside the professionalAssessmentPriorities carve-out) and the WHOLE narrative was
// discarded over it (fail-closed, correct) — but with no retry, that single roll of the
// dice decided whether the caregiver ever saw the section at all.
describe('AI results summary — retries a rejected generation before failing closed (2026-07-11)', () => {
  it('retries once when the first generation is rejected and returns the second, valid one', async () => {
    const unsafeFirstAttempt = buildOutput({
      home_recommendations: [
        'Keep a log — useful for future conversations with any professional.',
      ],
    });
    const { analysisService, screeningService, familiesRepository, aiSummaryClient } =
      await buildStack([unsafeFirstAttempt, VALID_OUTPUT]);
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

    expect(result).not.toBeNull();
    expect(aiSummaryClient.calls).toHaveLength(2);
  });

  it('still fails closed (returns null) when every attempt is rejected', async () => {
    const unsafeOutput = buildOutput({
      reasoning: 'A specialist could offer more guidance here.',
    });
    const { analysisService, screeningService, familiesRepository, aiSummaryClient } =
      await buildStack([unsafeOutput, unsafeOutput, unsafeOutput]);
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
    expect(aiSummaryClient.calls).toHaveLength(3);
  });

  it('does not retry a transport failure (null from the client)', async () => {
    const { analysisService, screeningService, familiesRepository, aiSummaryClient } =
      await buildStack([null]);
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
});

describe('AI results summary — fail closed (issue #104, CLAUDE.md §8)', () => {
  it('returns null and caches nothing for malformed model output that stays malformed on every retry', async () => {
    const { analysisService, screeningService, familiesRepository, aiSummaryClient } =
      await buildStack(['not json at all', 'still not json', 'nope']);
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
    expect(aiSummaryClient.calls).toHaveLength(3);
  });

  it('returns null when the model uses a reserved result label', async () => {
    const unsafeOutput = buildOutput({
      reasoning: 'Overall, Low signs observed across the answers given.',
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
    const unsafeOutput = buildOutput({
      developmental_profile: 'The answers do not suggest anything abnormal.',
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
  it('returns null when the model suggests professional follow-up in its own words OUTSIDE professionalAssessmentPriorities', async () => {
    const unsafeOutput = buildOutput({
      evidence_summary:
        'This detail deserves follow-up with a professional, worth discussing with a healthcare provider.',
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

  // Professional-referral carve-out (dual-assessment update, flagged for clinical-review
  // sign-off): professionalAssessmentPriorities is the ONE field allowed to name
  // professional/specialist assessment, since that's its entire stated purpose.
  it('accepts professional-assessment language INSIDE professionalAssessmentPriorities', async () => {
    const output = buildOutput({
      professional_assessment_priorities: [
        'A comprehensive social-communication evaluation with a developmental specialist may help build a fuller picture.',
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
      {
        child_id: child.id,
        question_id: 'T2',
        domain: 'communication',
        answer: 'few_1_5',
        timestamp: AT,
      },
    ]);

    const result = await analysisService.getResultsSummary(child.id);

    expect(result).not.toBeNull();
    expect(result?.professionalAssessmentPriorities).toEqual([
      'A comprehensive social-communication evaluation with a developmental specialist may help build a fuller picture.',
    ]);
  });

  // Carve-out boundary: the exemption is narrow — professionalAssessmentPriorities is
  // still checked against banned words / Assessment A's reserved result phrases, just not
  // the professional-referral-term ban.
  it('still rejects a reserved result label INSIDE professionalAssessmentPriorities', async () => {
    const unsafeOutput = buildOutput({
      professional_assessment_priorities: ['Formal assessment is recommended soon.'],
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

  it('returns null when uncertainty_factors carries a value outside the fixed enum', async () => {
    const unsafeOutput = buildOutput({ uncertainty_factors: ['not_a_real_factor'] });
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
      reasoning: 'This is worth discussing with a healthcare provider.',
    });

    const result = await analysisService.getResultsSummary(child.id);

    expect(result).not.toBeNull();
    expect(result?.reasoning).not.toContain('healthcare provider');
    expect(aiSummaryClient.calls).toHaveLength(2);
  });
});

describe('Comparison Section (CLAUDE.md §13/§14, dual-assessment update 2026-07-11)', () => {
  it('refuses to run without ai_analysis consent and never invokes the LLM client', async () => {
    const { analysisService, familiesRepository, aiSummaryClient } = await buildStack([
      VALID_OUTPUT,
    ]);
    const { child } = await familiesRepository.seedChildWithConsent(['data_storage']);

    await expect(analysisService.getComparisonResult(child.id)).rejects.toThrow(
      ForbiddenException,
    );
    expect(aiSummaryClient.calls).toHaveLength(0);
  });

  it('returns null when there is no AI summary yet (no answers)', async () => {
    const { analysisService, familiesRepository } = await buildStack([VALID_OUTPUT]);
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'ai_analysis',
    ]);

    const result = await analysisService.getComparisonResult(child.id);

    expect(result).toBeNull();
  });

  it('agreement: both assessments land in the same risk band', async () => {
    const output = buildOutput({ likelihood: 'Low' });
    const { analysisService, screeningService, familiesRepository } = await buildStack([
      output,
    ]);
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'ai_analysis',
    ]);
    await screeningService.submitIntakeResponses(
      child.id,
      REASSURING_BATCH.map((res) => ({ ...res, child_id: child.id })),
    );

    const result = await analysisService.getComparisonResult(child.id);

    expect(result).not.toBeNull();
    expect(result?.status).toBe('agreement');
    expect(result?.reasons).toEqual([]);
    expect(result?.assessmentABand).toBe('low');
    expect(result?.assessmentBBand).toBe('low');
  });

  it('partial agreement: bands are one apart', async () => {
    const output = buildOutput({ likelihood: 'Moderate' });
    const { analysisService, screeningService, familiesRepository } = await buildStack([
      output,
    ]);
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'ai_analysis',
    ]);
    await screeningService.submitIntakeResponses(
      child.id,
      REASSURING_BATCH.map((res) => ({ ...res, child_id: child.id })),
    );

    const result = await analysisService.getComparisonResult(child.id);

    expect(result?.status).toBe('partial_agreement');
    expect(result?.bandDistance).toBe(1);
  });

  it('disagreement: bands are at opposite ends', async () => {
    const output = buildOutput({ likelihood: 'Very High' });
    const { analysisService, screeningService, familiesRepository } = await buildStack([
      output,
    ]);
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'ai_analysis',
    ]);
    await screeningService.submitIntakeResponses(
      child.id,
      REASSURING_BATCH.map((res) => ({ ...res, child_id: child.id })),
    );

    const result = await analysisService.getComparisonResult(child.id);

    expect(result?.status).toBe('disagreement');
    expect(result?.bandDistance).toBe(2);
  });

  it('a red-flag case keeps the safety note in the narrative even though evidence is sparse (rule 8)', async () => {
    const output = buildOutput({ likelihood: 'Very Low', confidence: 'low' });
    const { analysisService, screeningService, familiesRepository } = await buildStack([
      output,
    ]);
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'ai_analysis',
    ]);
    // Same fixture as screening.integration.spec.ts's "urgent red-flag case": one answer,
    // far below every evidence floor, but red flags are exempt from the gate and force a
    // tier (CLAUDE.md §2 rule 8).
    await screeningService.submitIntakeResponses(child.id, [
      { ...r('RF_self_injury', 'yes'), child_id: child.id },
    ]);

    const result = await analysisService.getComparisonResult(child.id);

    expect(result).not.toBeNull();
    expect(result?.narrative).toContain(
      'A specific serious-sign answer was given directly by the caregiver.',
    );
  });
});

describe('AI results summary — photo evidence (issue #135, Phase 2)', () => {
  async function seedWithOneAnswer(
    familiesRepository: InMemoryFamiliesRepository,
    screeningService: ScreeningService,
    grantedScopes: Parameters<InMemoryFamiliesRepository['seedChildWithConsent']>[0],
  ) {
    const { family, child } =
      await familiesRepository.seedChildWithConsent(grantedScopes);
    await screeningService.submitIntakeResponses(child.id, [
      {
        child_id: child.id,
        question_id: 'T2',
        domain: 'communication',
        answer: 'few_1_5',
        timestamp: AT,
      },
    ]);
    return { family, child };
  }

  it('attaches photo evidence and records it in evidenceModalities when both consents are granted', async () => {
    const {
      analysisService,
      screeningService,
      familiesRepository,
      mediaService,
      aiSummaryClient,
    } = await buildStack([VALID_OUTPUT]);
    const { child } = await seedWithOneAnswer(familiesRepository, screeningService, [
      'data_storage',
      'ai_analysis',
      'media_capture',
    ]);
    await mediaService.upload(child.id, {
      kind: 'photo',
      mimeType: 'image/jpeg',
      data: Buffer.from('fake-photo-bytes'),
    });

    const result = await analysisService.getResultsSummary(child.id);

    expect(result).not.toBeNull();
    expect(result?.evidenceModalities).toEqual(
      expect.arrayContaining(['structured_answers', 'photo']),
    );
    expect(aiSummaryClient.calls).toHaveLength(1);
    expect(aiSummaryClient.calls[0]!.photos).toEqual([
      {
        mimeType: 'image/jpeg',
        base64Data: Buffer.from('fake-photo-bytes').toString('base64'),
      },
    ]);
  });

  it('sends no photo evidence, and never records "photo", when there is no media at all', async () => {
    const { analysisService, screeningService, familiesRepository, aiSummaryClient } =
      await buildStack([VALID_OUTPUT]);
    const { child } = await seedWithOneAnswer(familiesRepository, screeningService, [
      'data_storage',
      'ai_analysis',
      'media_capture',
    ]);

    const result = await analysisService.getResultsSummary(child.id);

    expect(result?.evidenceModalities).toEqual(['structured_answers']);
    expect(aiSummaryClient.calls[0]!.photos).toEqual([]);
  });

  it('omits photo evidence when media_capture consent is withdrawn, even though a photo already exists and ai_analysis is still granted', async () => {
    const {
      analysisService,
      screeningService,
      familiesRepository,
      mediaService,
      aiSummaryClient,
    } = await buildStack([VALID_OUTPUT]);
    const { family, child } = await seedWithOneAnswer(
      familiesRepository,
      screeningService,
      ['data_storage', 'ai_analysis', 'media_capture'],
    );
    await mediaService.upload(child.id, {
      kind: 'photo',
      mimeType: 'image/jpeg',
      data: Buffer.from('fake-photo-bytes'),
    });
    // Consent withdrawn AFTER capture — CLAUDE.md §15: media may never be analysed without
    // currently-granted consent, even though the asset itself is still stored.
    await familiesRepository.updateConsent(family.id, 'media_capture', false);

    const result = await analysisService.getResultsSummary(child.id);

    expect(result).not.toBeNull();
    expect(result?.evidenceModalities).toEqual(['structured_answers']);
    expect(aiSummaryClient.calls[0]!.photos).toEqual([]);
  });

  it('regenerates when a new photo is captured, even though the answered questions have not changed', async () => {
    const {
      analysisService,
      screeningService,
      familiesRepository,
      mediaService,
      aiSummaryClient,
    } = await buildStack([VALID_OUTPUT, VALID_OUTPUT]);
    const { child } = await seedWithOneAnswer(familiesRepository, screeningService, [
      'data_storage',
      'ai_analysis',
      'media_capture',
    ]);

    await analysisService.getResultsSummary(child.id);
    await mediaService.upload(child.id, {
      kind: 'photo',
      mimeType: 'image/jpeg',
      data: Buffer.from('fake-photo-bytes'),
    });
    await analysisService.getResultsSummary(child.id);

    expect(aiSummaryClient.calls).toHaveLength(2);
    expect(aiSummaryClient.calls[0]!.photos).toEqual([]);
    expect(aiSummaryClient.calls[1]!.photos).toHaveLength(1);
  });

  it('skips an unsupported photo mime type rather than sending it to the vision call', async () => {
    const {
      analysisService,
      screeningService,
      familiesRepository,
      mediaService,
      aiSummaryClient,
    } = await buildStack([VALID_OUTPUT]);
    const { child } = await seedWithOneAnswer(familiesRepository, screeningService, [
      'data_storage',
      'ai_analysis',
      'media_capture',
    ]);
    await mediaService.upload(child.id, {
      kind: 'photo',
      mimeType: 'image/heic',
      data: Buffer.from('unsupported-format-bytes'),
    });

    const result = await analysisService.getResultsSummary(child.id);

    expect(result?.evidenceModalities).toEqual(['structured_answers']);
    expect(aiSummaryClient.calls[0]!.photos).toEqual([]);
  });

  it('caps photo evidence at MAX_ANALYZABLE_PHOTOS, keeping the most recently captured', async () => {
    const {
      analysisService,
      screeningService,
      familiesRepository,
      mediaService,
      aiSummaryClient,
    } = await buildStack([VALID_OUTPUT]);
    const { child } = await seedWithOneAnswer(familiesRepository, screeningService, [
      'data_storage',
      'ai_analysis',
      'media_capture',
    ]);
    for (let i = 0; i < MAX_ANALYZABLE_PHOTOS + 2; i++) {
      await mediaService.upload(child.id, {
        kind: 'photo',
        mimeType: 'image/jpeg',
        data: Buffer.from(`photo-${i}`),
        capturedAt: new Date(Date.parse(AT) + i * 1000).toISOString(),
      });
    }

    const result = await analysisService.getResultsSummary(child.id);

    expect(result).not.toBeNull();
    expect(aiSummaryClient.calls[0]!.photos).toHaveLength(MAX_ANALYZABLE_PHOTOS);
  });

  it('never sends an audio asset as photo or video-frame evidence (issue #140 wires it into its own audioTranscripts field instead)', async () => {
    const {
      analysisService,
      screeningService,
      familiesRepository,
      mediaService,
      aiSummaryClient,
    } = await buildStack([VALID_OUTPUT]);
    const { child } = await seedWithOneAnswer(familiesRepository, screeningService, [
      'data_storage',
      'ai_analysis',
      'media_capture',
    ]);
    await mediaService.upload(child.id, {
      kind: 'audio',
      mimeType: 'audio/mp4',
      data: Buffer.from('fake-audio-bytes'),
    });

    const result = await analysisService.getResultsSummary(child.id);

    expect(result?.evidenceModalities).toEqual(
      expect.arrayContaining(['structured_answers', 'audio']),
    );
    expect(aiSummaryClient.calls[0]!.photos).toEqual([]);
    expect(aiSummaryClient.calls[0]!.videoFrames).toEqual([]);
    expect(aiSummaryClient.calls[0]!.audioTranscripts).toHaveLength(1);
  });
});

describe('AI results summary — audio evidence (issue #140, Phase 4)', () => {
  async function seedWithOneAnswer(
    familiesRepository: InMemoryFamiliesRepository,
    screeningService: ScreeningService,
    grantedScopes: Parameters<InMemoryFamiliesRepository['seedChildWithConsent']>[0],
  ) {
    const { family, child } =
      await familiesRepository.seedChildWithConsent(grantedScopes);
    await screeningService.submitIntakeResponses(child.id, [
      {
        child_id: child.id,
        question_id: 'T2',
        domain: 'communication',
        answer: 'few_1_5',
        timestamp: AT,
      },
    ]);
    return { family, child };
  }

  it('transcribes and attaches audio evidence, records it in evidenceModalities, when both consents are granted', async () => {
    const {
      analysisService,
      screeningService,
      familiesRepository,
      mediaService,
      aiSummaryClient,
    } = await buildStack([VALID_OUTPUT]);
    const { child } = await seedWithOneAnswer(familiesRepository, screeningService, [
      'data_storage',
      'ai_analysis',
      'media_capture',
    ]);
    await mediaService.upload(child.id, {
      kind: 'audio',
      mimeType: 'audio/m4a',
      data: Buffer.from('fake-audio-bytes'),
    });

    const result = await analysisService.getResultsSummary(child.id);

    expect(result).not.toBeNull();
    expect(result?.evidenceModalities).toEqual(
      expect.arrayContaining(['structured_answers', 'audio']),
    );
    expect(aiSummaryClient.calls).toHaveLength(1);
    expect(aiSummaryClient.calls[0]!.audioTranscripts).toEqual([
      { transcript: 'transcript-of:fake-audio-bytes' },
    ]);
  });

  it('sends no audio evidence, and never records "audio", when there is no media at all', async () => {
    const { analysisService, screeningService, familiesRepository, aiSummaryClient } =
      await buildStack([VALID_OUTPUT]);
    const { child } = await seedWithOneAnswer(familiesRepository, screeningService, [
      'data_storage',
      'ai_analysis',
      'media_capture',
    ]);

    const result = await analysisService.getResultsSummary(child.id);

    expect(result?.evidenceModalities).toEqual(['structured_answers']);
    expect(aiSummaryClient.calls[0]!.audioTranscripts).toEqual([]);
  });

  it('omits audio evidence when media_capture consent is withdrawn, even though a clip already exists and ai_analysis is still granted', async () => {
    const {
      analysisService,
      screeningService,
      familiesRepository,
      mediaService,
      aiSummaryClient,
    } = await buildStack([VALID_OUTPUT]);
    const { family, child } = await seedWithOneAnswer(
      familiesRepository,
      screeningService,
      ['data_storage', 'ai_analysis', 'media_capture'],
    );
    await mediaService.upload(child.id, {
      kind: 'audio',
      mimeType: 'audio/m4a',
      data: Buffer.from('fake-audio-bytes'),
    });
    await familiesRepository.updateConsent(family.id, 'media_capture', false);

    const result = await analysisService.getResultsSummary(child.id);

    expect(result).not.toBeNull();
    expect(result?.evidenceModalities).toEqual(['structured_answers']);
    expect(aiSummaryClient.calls[0]!.audioTranscripts).toEqual([]);
  });

  it('regenerates when a new clip is captured, even though the answered questions have not changed', async () => {
    const {
      analysisService,
      screeningService,
      familiesRepository,
      mediaService,
      aiSummaryClient,
    } = await buildStack([VALID_OUTPUT, VALID_OUTPUT]);
    const { child } = await seedWithOneAnswer(familiesRepository, screeningService, [
      'data_storage',
      'ai_analysis',
      'media_capture',
    ]);

    await analysisService.getResultsSummary(child.id);
    await mediaService.upload(child.id, {
      kind: 'audio',
      mimeType: 'audio/m4a',
      data: Buffer.from('fake-audio-bytes'),
    });
    await analysisService.getResultsSummary(child.id);

    expect(aiSummaryClient.calls).toHaveLength(2);
    expect(aiSummaryClient.calls[0]!.audioTranscripts).toEqual([]);
    expect(aiSummaryClient.calls[1]!.audioTranscripts).toHaveLength(1);
  });

  it('skips an unsupported audio mime type rather than attempting transcription on it', async () => {
    const {
      analysisService,
      screeningService,
      familiesRepository,
      mediaService,
      aiSummaryClient,
    } = await buildStack([VALID_OUTPUT]);
    const { child } = await seedWithOneAnswer(familiesRepository, screeningService, [
      'data_storage',
      'ai_analysis',
      'media_capture',
    ]);
    await mediaService.upload(child.id, {
      kind: 'audio',
      mimeType: 'audio/x-unsupported',
      data: Buffer.from('unsupported-format-bytes'),
    });

    const result = await analysisService.getResultsSummary(child.id);

    expect(result?.evidenceModalities).toEqual(['structured_answers']);
    expect(aiSummaryClient.calls[0]!.audioTranscripts).toEqual([]);
  });

  it('caps audio evidence at MAX_ANALYZABLE_AUDIO_CLIPS, keeping the most recently captured', async () => {
    const {
      analysisService,
      screeningService,
      familiesRepository,
      mediaService,
      aiSummaryClient,
    } = await buildStack([VALID_OUTPUT]);
    const { child } = await seedWithOneAnswer(familiesRepository, screeningService, [
      'data_storage',
      'ai_analysis',
      'media_capture',
    ]);
    for (let i = 0; i < MAX_ANALYZABLE_AUDIO_CLIPS + 2; i++) {
      await mediaService.upload(child.id, {
        kind: 'audio',
        mimeType: 'audio/m4a',
        data: Buffer.from(`audio-${i}`),
        capturedAt: new Date(Date.parse(AT) + i * 1000).toISOString(),
      });
    }

    const result = await analysisService.getResultsSummary(child.id);

    expect(result).not.toBeNull();
    expect(aiSummaryClient.calls[0]!.audioTranscripts).toHaveLength(
      MAX_ANALYZABLE_AUDIO_CLIPS,
    );
  });

  it('transcribes a clip at most once — a second results-summary call reuses the cached transcript without calling the STT service again', async () => {
    const {
      analysisService,
      screeningService,
      familiesRepository,
      mediaService,
      aiSummaryClient,
      audioTranscription,
    } = await buildStack([VALID_OUTPUT, VALID_OUTPUT]);
    const { child } = await seedWithOneAnswer(familiesRepository, screeningService, [
      'data_storage',
      'ai_analysis',
      'media_capture',
    ]);
    await mediaService.upload(child.id, {
      kind: 'audio',
      mimeType: 'audio/m4a',
      data: Buffer.from('fake-audio-bytes'),
    });

    await analysisService.getResultsSummary(child.id);
    // Force regeneration on the next call without the audio asset set changing, so any
    // repeated STT call would be visible even though the cached AI summary itself is reused
    // for an unchanged answer/media set — bust the summary cache the same way the "new
    // photo/video" tests do: by adding a new answer.
    await screeningService.submitIntakeResponses(child.id, [
      {
        child_id: child.id,
        question_id: 'T3',
        domain: 'communication',
        answer: 'yes_often',
        timestamp: LATER,
      },
    ]);
    await analysisService.getResultsSummary(child.id);

    expect(aiSummaryClient.calls).toHaveLength(2);
    expect(audioTranscription.calls).toHaveLength(1);
    expect(aiSummaryClient.calls[1]!.audioTranscripts).toEqual([
      { transcript: 'transcript-of:fake-audio-bytes' },
    ]);
  });
});

describe('AI results summary — video evidence (issue #139, Phase 3)', () => {
  async function seedWithOneAnswer(
    familiesRepository: InMemoryFamiliesRepository,
    screeningService: ScreeningService,
    grantedScopes: Parameters<InMemoryFamiliesRepository['seedChildWithConsent']>[0],
  ) {
    const { family, child } =
      await familiesRepository.seedChildWithConsent(grantedScopes);
    await screeningService.submitIntakeResponses(child.id, [
      {
        child_id: child.id,
        question_id: 'T2',
        domain: 'communication',
        answer: 'few_1_5',
        timestamp: AT,
      },
    ]);
    return { family, child };
  }

  it('extracts and attaches video-frame evidence, records it in evidenceModalities, when both consents are granted', async () => {
    const {
      analysisService,
      screeningService,
      familiesRepository,
      mediaService,
      aiSummaryClient,
    } = await buildStack([VALID_OUTPUT]);
    const { child } = await seedWithOneAnswer(familiesRepository, screeningService, [
      'data_storage',
      'ai_analysis',
      'media_capture',
    ]);
    await mediaService.upload(child.id, {
      kind: 'video',
      mimeType: 'video/mp4',
      data: Buffer.from('fake-video-bytes'),
    });

    const result = await analysisService.getResultsSummary(child.id);

    expect(result).not.toBeNull();
    expect(result?.evidenceModalities).toEqual(
      expect.arrayContaining(['structured_answers', 'video']),
    );
    expect(aiSummaryClient.calls).toHaveLength(1);
    expect(aiSummaryClient.calls[0]!.videoFrames).toHaveLength(3);
    expect(aiSummaryClient.calls[0]!.videoFrames[0]).toEqual({
      mimeType: 'image/jpeg',
      base64Data: Buffer.from('fake-video-bytes-frame-0').toString('base64'),
    });
  });

  it('sends no video-frame evidence, and never records "video", when there is no media at all', async () => {
    const { analysisService, screeningService, familiesRepository, aiSummaryClient } =
      await buildStack([VALID_OUTPUT]);
    const { child } = await seedWithOneAnswer(familiesRepository, screeningService, [
      'data_storage',
      'ai_analysis',
      'media_capture',
    ]);

    const result = await analysisService.getResultsSummary(child.id);

    expect(result?.evidenceModalities).toEqual(['structured_answers']);
    expect(aiSummaryClient.calls[0]!.videoFrames).toEqual([]);
  });

  it('omits video-frame evidence when media_capture consent is withdrawn, even though a video already exists and ai_analysis is still granted', async () => {
    const {
      analysisService,
      screeningService,
      familiesRepository,
      mediaService,
      aiSummaryClient,
    } = await buildStack([VALID_OUTPUT]);
    const { family, child } = await seedWithOneAnswer(
      familiesRepository,
      screeningService,
      ['data_storage', 'ai_analysis', 'media_capture'],
    );
    await mediaService.upload(child.id, {
      kind: 'video',
      mimeType: 'video/mp4',
      data: Buffer.from('fake-video-bytes'),
    });
    await familiesRepository.updateConsent(family.id, 'media_capture', false);

    const result = await analysisService.getResultsSummary(child.id);

    expect(result).not.toBeNull();
    expect(result?.evidenceModalities).toEqual(['structured_answers']);
    expect(aiSummaryClient.calls[0]!.videoFrames).toEqual([]);
  });

  it('regenerates when a new video is captured, even though the answered questions have not changed', async () => {
    const {
      analysisService,
      screeningService,
      familiesRepository,
      mediaService,
      aiSummaryClient,
    } = await buildStack([VALID_OUTPUT, VALID_OUTPUT]);
    const { child } = await seedWithOneAnswer(familiesRepository, screeningService, [
      'data_storage',
      'ai_analysis',
      'media_capture',
    ]);

    await analysisService.getResultsSummary(child.id);
    await mediaService.upload(child.id, {
      kind: 'video',
      mimeType: 'video/mp4',
      data: Buffer.from('fake-video-bytes'),
    });
    await analysisService.getResultsSummary(child.id);

    expect(aiSummaryClient.calls).toHaveLength(2);
    expect(aiSummaryClient.calls[0]!.videoFrames).toEqual([]);
    expect(aiSummaryClient.calls[1]!.videoFrames).toHaveLength(3);
  });

  it('skips an unsupported video mime type rather than attempting frame extraction on it', async () => {
    const {
      analysisService,
      screeningService,
      familiesRepository,
      mediaService,
      aiSummaryClient,
    } = await buildStack([VALID_OUTPUT]);
    const { child } = await seedWithOneAnswer(familiesRepository, screeningService, [
      'data_storage',
      'ai_analysis',
      'media_capture',
    ]);
    await mediaService.upload(child.id, {
      kind: 'video',
      mimeType: 'video/x-msvideo',
      data: Buffer.from('unsupported-format-bytes'),
    });

    const result = await analysisService.getResultsSummary(child.id);

    expect(result?.evidenceModalities).toEqual(['structured_answers']);
    expect(aiSummaryClient.calls[0]!.videoFrames).toEqual([]);
  });

  it('caps video evidence at MAX_ANALYZABLE_VIDEOS, keeping the most recently captured', async () => {
    const {
      analysisService,
      screeningService,
      familiesRepository,
      mediaService,
      aiSummaryClient,
    } = await buildStack([VALID_OUTPUT]);
    const { child } = await seedWithOneAnswer(familiesRepository, screeningService, [
      'data_storage',
      'ai_analysis',
      'media_capture',
    ]);
    for (let i = 0; i < MAX_ANALYZABLE_VIDEOS + 2; i++) {
      await mediaService.upload(child.id, {
        kind: 'video',
        mimeType: 'video/mp4',
        data: Buffer.from(`video-${i}`),
        capturedAt: new Date(Date.parse(AT) + i * 1000).toISOString(),
      });
    }

    const result = await analysisService.getResultsSummary(child.id);

    expect(result).not.toBeNull();
    expect(aiSummaryClient.calls[0]!.videoFrames).toHaveLength(MAX_ANALYZABLE_VIDEOS * 3);
  });

  it('contributes zero frames, without failing the whole call, when a video cannot be probed/extracted', async () => {
    const {
      analysisService,
      screeningService,
      familiesRepository,
      mediaService,
      aiSummaryClient,
      frameExtraction,
    } = await buildStack([VALID_OUTPUT]);
    frameExtraction.framesPerVideo = 0; // simulates an unprobeable/corrupt video
    const { child } = await seedWithOneAnswer(familiesRepository, screeningService, [
      'data_storage',
      'ai_analysis',
      'media_capture',
    ]);
    await mediaService.upload(child.id, {
      kind: 'video',
      mimeType: 'video/mp4',
      data: Buffer.from('fake-video-bytes'),
    });

    const result = await analysisService.getResultsSummary(child.id);

    expect(result).not.toBeNull();
    expect(result?.evidenceModalities).toEqual(['structured_answers']);
    expect(aiSummaryClient.calls[0]!.videoFrames).toEqual([]);
  });

  it('attaches both photo and video-frame evidence together when both are present', async () => {
    const {
      analysisService,
      screeningService,
      familiesRepository,
      mediaService,
      aiSummaryClient,
    } = await buildStack([VALID_OUTPUT]);
    const { child } = await seedWithOneAnswer(familiesRepository, screeningService, [
      'data_storage',
      'ai_analysis',
      'media_capture',
    ]);
    await mediaService.upload(child.id, {
      kind: 'photo',
      mimeType: 'image/jpeg',
      data: Buffer.from('fake-photo-bytes'),
    });
    await mediaService.upload(child.id, {
      kind: 'video',
      mimeType: 'video/mp4',
      data: Buffer.from('fake-video-bytes'),
    });

    const result = await analysisService.getResultsSummary(child.id);

    expect(result?.evidenceModalities).toEqual(
      expect.arrayContaining(['structured_answers', 'photo', 'video']),
    );
    expect(aiSummaryClient.calls[0]!.photos).toHaveLength(1);
    expect(aiSummaryClient.calls[0]!.videoFrames).toHaveLength(3);
  });
});
