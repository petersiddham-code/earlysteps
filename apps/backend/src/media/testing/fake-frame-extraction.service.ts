/**
 * Test double ONLY — deterministically derives fake "frames" from the input video buffer
 * without invoking real ffmpeg, mirroring the in-memory repository/storage doubles. Never
 * register this in AppModule/MediaModule providers.
 */
import type { ExtractedVideoFrame, FrameExtractionService } from '../frame-extraction.js';

export class FakeFrameExtractionService implements FrameExtractionService {
  /** Every (video, mimeType) pair this was called with, in order. */
  readonly calls: { video: Buffer; mimeType: string }[] = [];
  /** Test hook: how many frames to fabricate per call — set to 0 to simulate an
   * unprobeable/corrupt video. */
  framesPerVideo = 3;

  async extractFrames(video: Buffer, mimeType: string): Promise<ExtractedVideoFrame[]> {
    this.calls.push({ video, mimeType });
    return Array.from({ length: this.framesPerVideo }, (_, i) => ({
      mimeType: 'image/jpeg' as const,
      data: Buffer.from(`${video.toString('utf8')}-frame-${i}`),
    }));
  }
}
