/**
 * Loads the response-analysis system prompt from the canonical template files in
 * src/ai/prompts/ (CLAUDE.md §8: one file per use case, guardrails kept as a single
 * source of truth in _guardrails.md and PREPENDED — never duplicated inline).
 *
 * The monorepo runs everything from TypeScript source (ts-node/vitest), so resolving
 * relative to this file is stable in dev, tests, and CI. Loading is lazy and throwing:
 * a missing/empty guardrail block must never result in an un-guardrailed LLM call
 * (CLAUDE.md §2 rule 12) — the caller treats the throw as "analysis unavailable".
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { AiSummaryAnsweredQuestion } from './ai-summary-client.js';

const PROMPTS_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../src/ai/prompts',
);

/** Strips the HTML comment headers the prompt files carry for human readers. */
function stripComments(markdown: string): string {
  return markdown.replace(/<!--[\s\S]*?-->/g, '').trim();
}

function loadPromptFile(name: string): string {
  const text = stripComments(readFileSync(resolve(PROMPTS_DIR, name), 'utf8'));
  if (text.length === 0) {
    throw new Error(`Prompt template ${name} is empty after stripping comments`);
  }
  return text;
}

let cachedSystemPrompt: string | null = null;

/** Guardrail block + response-analysis task block, in that order (guardrails first). */
export function getResponseAnalysisSystemPrompt(): string {
  if (cachedSystemPrompt === null) {
    const guardrails = loadPromptFile('_guardrails.md');
    const task = loadPromptFile('response-analysis.md');
    cachedSystemPrompt = `${guardrails}\n\n${task}`;
  }
  return cachedSystemPrompt;
}

/**
 * Substitutes the input into the task template's tagged placeholders. The template
 * instructs the model to treat tag contents as data, never instructions — belt and
 * suspenders against prompt injection via a typed answer.
 */
export function buildAnalysisUserMessage(questionText: string, freeText: string): string {
  return [
    'Analyze this caregiver note.',
    `<question_text>${questionText}</question_text>`,
    `<free_text_answer>${freeText}</free_text_answer>`,
  ].join('\n');
}

let cachedResultsSummarySystemPrompt: string | null = null;

/** Guardrail block + results-summary task block, in that order (guardrails first). */
export function getResultsSummarySystemPrompt(): string {
  if (cachedResultsSummarySystemPrompt === null) {
    const guardrails = loadPromptFile('_guardrails.md');
    const task = loadPromptFile('results-summary.md');
    cachedResultsSummarySystemPrompt = `${guardrails}\n\n${task}`;
  }
  return cachedResultsSummarySystemPrompt;
}

/** One answered question rendered as plain text for the results-summary prompt. */
function formatAnsweredQuestion(answer: AiSummaryAnsweredQuestion): string {
  const parts = [
    `Q: ${answer.questionText}`,
    `Selected: ${answer.selectedLabels.join(', ') || '(none)'}`,
  ];
  if (answer.freeText) parts.push(`Note: ${answer.freeText}`);
  return parts.join(' | ');
}

/**
 * Substitutes the input into the results-summary task template's tagged placeholders.
 * The template instructs the model to treat tag contents as data, never instructions —
 * belt and suspenders against prompt injection via a typed answer.
 */
/**
 * `photoCount`/`videoFrameCount` (issue #135 Phase 2, issue #139 Phase 3): always present,
 * even at 0, so the model gets a consistent frame for "no media evidence this time" rather
 * than an absent tag it might otherwise read as ambiguous. The actual image bytes (if any)
 * are attached as separate content blocks by the caller, photos first then video frames —
 * this tag only tells the model how many of each to expect, in that order.
 */
/**
 * `audioTranscripts` (issue #140, Phase 4): rendered as its own `<audio_evidence>` tag,
 * always present (even when empty), so the model gets a consistent frame the same way
 * `<media_evidence>` always states a photo/video-frame count even at 0.
 */
export function buildResultsSummaryUserMessage(
  ageBand: string,
  gender: string | undefined,
  answers: AiSummaryAnsweredQuestion[],
  photoCount: number,
  videoFrameCount: number,
  audioTranscripts: string[],
): string {
  const audioEvidenceBody =
    audioTranscripts.length === 0
      ? `${audioTranscripts.length} audio recording(s) transcribed this time.`
      : [
          `${audioTranscripts.length} audio recording(s), each automatically transcribed by speech-to-text from a caregiver-captured recording — NOT text the caregiver typed. Transcription may be imprecise (garbled words, mishearing, background noise, non-speech sound); weigh accordingly and name that uncertainty explicitly where relevant.`,
          ...audioTranscripts.map(
            (transcript, i) => `Transcript ${i + 1}: "${transcript}"`,
          ),
        ].join('\n');
  return [
    'Write the independent AI results summary for this raw questionnaire.',
    `<age_band>${ageBand}</age_band>`,
    `<gender>${gender ?? 'not given'}</gender>`,
    `<answers>\n${answers.map(formatAnsweredQuestion).join('\n')}\n</answers>`,
    `<media_evidence>${photoCount} caregiver-captured photo(s), then ${videoFrameCount} still frame(s) sampled from caregiver-captured video(s), attached below as image content in that order, if any. Each photo is an opt-in observational snapshot; each video-derived frame is one sampled moment from a recording, not continuous footage. Weigh all of it alongside the structured answers and notes above per the media-evidence rules in your instructions.</media_evidence>`,
    `<audio_evidence>${audioEvidenceBody}</audio_evidence>`,
  ].join('\n');
}
