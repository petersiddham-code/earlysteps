/**
 * Production AudioTranscriptionService — OpenAI's cloud speech-to-text API (issue #140),
 * a deliberate scope decision made with the user before implementation: a cloud API,
 * chosen over a self-hosted model, trades a new third-party data flow (raw child audio
 * leaves this backend for the duration of one transcription call) for far lower backend
 * compute cost and a much simpler deploy than bundling/running a speech model in-process.
 *
 * The SDK reads OPENAI_API_KEY from the environment; the module factory only constructs
 * this class when that key is configured (mirrors ClaudeResponseAnalysisClient/
 * ClaudeAiResultsSummaryClient's ANTHROPIC_API_KEY wiring).
 */
import OpenAI, { toFile } from 'openai';
import { Injectable, Logger } from '@nestjs/common';
import type { AudioTranscriptionService } from './audio-transcription.js';

export const AUDIO_TRANSCRIPTION_MODEL = 'whisper-1';

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'audio/m4a': 'm4a',
  'audio/mp4': 'm4a',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
  'audio/mpeg': 'mp3',
};

@Injectable()
export class OpenAiAudioTranscriptionService implements AudioTranscriptionService {
  private readonly logger = new Logger(OpenAiAudioTranscriptionService.name);
  private readonly client = new OpenAI();

  async transcribe(audio: Buffer, mimeType: string): Promise<string | null> {
    try {
      const extension = EXTENSION_BY_MIME_TYPE[mimeType] ?? 'm4a';
      const response = await this.client.audio.transcriptions.create({
        file: await toFile(audio, `recording.${extension}`, { type: mimeType }),
        model: AUDIO_TRANSCRIPTION_MODEL,
      });
      const text = response.text.trim();
      return text.length > 0 ? text : null;
    } catch (error) {
      // Never let a transcription failure surface to the caregiver flow — the results-
      // summary call must be unaffected (fail closed, CLAUDE.md §8), same precedent as a
      // corrupt photo/video asset.
      this.logger.warn(
        `audio transcription failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }
}
