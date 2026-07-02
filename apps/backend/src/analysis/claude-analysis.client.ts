/**
 * Production ResponseAnalysisClient — Claude API via the official SDK.
 *
 * Model: claude-sonnet-4-6 (CLAUDE.md §3). The system prompt is ALWAYS the shared
 * guardrail block + the response-analysis template from src/ai/prompts/ (CLAUDE.md §2
 * rule 12) — if the templates can't be loaded, the call is not made at all.
 *
 * Every failure mode (transport error, refusal, empty content) returns null so the
 * stage contributes nothing (fail closed, CLAUDE.md §8). The SDK reads
 * ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL from the environment; the module factory
 * only constructs this class when a key is configured.
 */
import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger } from '@nestjs/common';
import type { FreeTextAnalysisInput, ResponseAnalysisClient } from './analysis-client.js';
import { buildAnalysisUserMessage, getResponseAnalysisSystemPrompt } from './prompt.js';

export const RESPONSE_ANALYSIS_MODEL = 'claude-sonnet-4-6';

/** One typed note is a short task; plenty for {"signals": [...max 3...]}. */
const MAX_OUTPUT_TOKENS = 1024;

/** Cap what we send: a free-text box is a note, not a document. */
const MAX_FREE_TEXT_CHARS = 2000;

@Injectable()
export class ClaudeResponseAnalysisClient implements ResponseAnalysisClient {
  private readonly logger = new Logger(ClaudeResponseAnalysisClient.name);
  private readonly client = new Anthropic();

  async analyzeFreeText(input: FreeTextAnalysisInput): Promise<string | null> {
    try {
      const response = await this.client.messages.create({
        model: RESPONSE_ANALYSIS_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: getResponseAnalysisSystemPrompt(),
        messages: [
          {
            role: 'user',
            content: buildAnalysisUserMessage(
              input.questionText.slice(0, MAX_FREE_TEXT_CHARS),
              input.freeText.slice(0, MAX_FREE_TEXT_CHARS),
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
      // Never let an analysis failure surface to the caregiver flow — the
      // deterministic pipeline must be unaffected (issue #26, offline-first).
      this.logger.warn(
        `response analysis call failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
