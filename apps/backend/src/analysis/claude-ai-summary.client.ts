/**
 * Production AiResultsSummaryClient — Claude API via the official SDK (issue #104).
 *
 * Model: claude-sonnet-4-6 (CLAUDE.md §3). The system prompt is ALWAYS the shared
 * guardrail block + the results-summary template from src/ai/prompts/ (CLAUDE.md §2 rule
 * 12) — if the templates can't be loaded, the call is not made at all.
 *
 * Every failure mode (transport error, refusal, empty content) returns null so the
 * section simply doesn't render (fail closed, CLAUDE.md §8).
 */
import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import type {
  AiResultsSummaryClient,
  AiResultsSummaryInput,
  AiSummaryAnsweredQuestion,
} from './ai-summary-client.js';
import {
  buildResultsSummaryUserMessage,
  getResultsSummarySystemPrompt,
} from './prompt.js';

export const AI_RESULTS_SUMMARY_MODEL = 'claude-sonnet-4-6';

/**
 * v2 (dual-assessment update): a tiered support-priorities object plus the rest of the
 * CLAUDE.md §13 schema is a materially larger document than v1's four short sections.
 */
const MAX_OUTPUT_TOKENS = 4096;

/** Cap what we send per free-text note: a note is a note, not a document. */
const MAX_FREE_TEXT_CHARS = 2000;

function capFreeText(answer: AiSummaryAnsweredQuestion): AiSummaryAnsweredQuestion {
  return answer.freeText
    ? { ...answer, freeText: answer.freeText.slice(0, MAX_FREE_TEXT_CHARS) }
    : answer;
}

@Injectable()
export class ClaudeAiResultsSummaryClient implements AiResultsSummaryClient {
  private readonly logger = new Logger(ClaudeAiResultsSummaryClient.name);
  private readonly client = new Anthropic();

  async generateSummary(input: AiResultsSummaryInput): Promise<string | null> {
    try {
      const response = await this.client.messages.create({
        model: AI_RESULTS_SUMMARY_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: getResultsSummarySystemPrompt(),
        messages: [
          {
            role: 'user',
            content: buildResultsSummaryUserMessage(
              input.ageBand,
              input.gender,
              input.answers.map(capFreeText),
            ),
          },
        ],
      });
      const text = response.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('');
      return text.length > 0 ? text : null;
    } catch (error) {
      // Never let a generation failure surface to the caregiver flow — the deterministic
      // Results screen must be unaffected (issue #104, offline-first).
      this.logger.warn(
        `results-summary generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
