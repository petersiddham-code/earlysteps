/**
 * Port (interface) for turning a stored audio clip's decrypted bytes into a plain-text
 * transcript Assessment B's evidence pipeline can use (issue #140, Phase 4 of the
 * media-assessment plan). Claude's Messages API has no audio content block, so a
 * transcript is the only way recorded speech can reach Assessment B at all.
 *
 * Two implementations exist, mirroring the FrameExtractionService/AiResultsSummaryClient
 * pattern elsewhere in this module:
 *  - OpenAiAudioTranscriptionService (production, cloud STT via the official `openai` SDK —
 *    scope decision made with the user before implementation: a cloud API over a
 *    self-hosted model, trading a new third-party data flow for much lower backend compute
 *    cost and simpler deploys)
 *  - FakeAudioTranscriptionService (test double, src/media/testing/ — never wired into
 *    AppModule) so unit/integration tests don't need a real API key or network call.
 */

export interface AudioTranscriptionService {
  /**
   * Returns the transcript text, or null when transcription is unavailable (no API key
   * configured, transport failure, empty/unintelligible result). Callers must treat null
   * the same as "no audio evidence available this time," not an error — this asset simply
   * contributes nothing rather than failing the whole results-summary call (CLAUDE.md §8).
   */
  transcribe(audio: Buffer, mimeType: string): Promise<string | null>;
}

export const AUDIO_TRANSCRIPTION_SERVICE = Symbol('AUDIO_TRANSCRIPTION_SERVICE');

/**
 * Wired when no OPENAI_API_KEY is configured: audio evidence silently contributes nothing
 * and the rest of the results-summary call is unaffected (offline-first, same precedent as
 * DisabledResponseAnalysisClient/DisabledAiResultsSummaryClient).
 */
export class DisabledAudioTranscriptionService implements AudioTranscriptionService {
  async transcribe(): Promise<null> {
    return null;
  }
}
