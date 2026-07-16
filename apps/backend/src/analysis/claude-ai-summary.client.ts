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
  AiSummaryPhotoEvidence,
  AiSummaryVideoFrameEvidence,
} from './ai-summary-client.js';
import {
  buildResultsSummaryUserMessage,
  getResultsSummarySystemPrompt,
} from './prompt.js';

/** The only media types the Claude vision API accepts as an image content block. */
type SupportedImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
const SUPPORTED_IMAGE_MEDIA_TYPES = new Set<string>([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

function isSupportedImageMediaType(
  mimeType: string,
): mimeType is SupportedImageMediaType {
  return SUPPORTED_IMAGE_MEDIA_TYPES.has(mimeType);
}

/**
 * Image content blocks for every photo/video-frame with a mime type the vision API accepts.
 * MediaService already filters to this same set before handing evidence to this client —
 * filtered again here so this client stays correct even if that upstream guarantee ever
 * changes. Shared between photos and video frames (issue #139) since both reduce to the
 * same `{mimeType, base64Data}` → image-block shape.
 */
function toImageBlocks(
  items: (AiSummaryPhotoEvidence | AiSummaryVideoFrameEvidence)[],
): Anthropic.ImageBlockParam[] {
  return items
    .filter((item) => isSupportedImageMediaType(item.mimeType))
    .map((item) => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: item.mimeType as SupportedImageMediaType,
        data: item.base64Data,
      },
    }));
}

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
      const photoBlocks = toImageBlocks(input.photos);
      // Video frames are attached AFTER photos — see AiResultsSummaryInput.videoFrames'
      // doc comment for why the ordering here must match the counts stated in the tag.
      const videoFrameBlocks = toImageBlocks(input.videoFrames);
      const response = await this.client.messages.create({
        model: AI_RESULTS_SUMMARY_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: getResultsSummarySystemPrompt(),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: buildResultsSummaryUserMessage(
                  input.ageBand,
                  input.gender,
                  input.answers.map(capFreeText),
                  photoBlocks.length,
                  videoFrameBlocks.length,
                ),
              },
              ...photoBlocks,
              ...videoFrameBlocks,
            ],
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
