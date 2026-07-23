/**
 * Test double ONLY — deterministically derives a fake transcript from the input audio
 * buffer without calling a real STT API, mirroring FakeFrameExtractionService. Never
 * register this in AppModule/MediaModule providers.
 */
import type { AudioTranscriptionService } from '../audio-transcription.js';

export class FakeAudioTranscriptionService implements AudioTranscriptionService {
  /** Every (audio, mimeType) pair this was called with, in order. */
  readonly calls: { audio: Buffer; mimeType: string }[] = [];
  /** Test hook: set to make the next call(s) return null, simulating an unavailable/failed
   * transcription. */
  nextResultIsNull = false;

  async transcribe(audio: Buffer, mimeType: string): Promise<string | null> {
    this.calls.push({ audio, mimeType });
    if (this.nextResultIsNull) return null;
    return `transcript-of:${audio.toString('utf8')}`;
  }
}
