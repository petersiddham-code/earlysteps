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
