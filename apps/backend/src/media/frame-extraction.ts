/**
 * Port (interface) for turning a stored video's decrypted bytes into still frames Assessment
 * B's vision call can use (issue #139, Phase 3 of the media-assessment plan). Claude's
 * Messages API has no video content block — only `image` — so this is the piece Phase 2
 * (issue #135) explicitly deferred: "no frame-extraction... capability exists in this backend
 * today."
 *
 * Two implementations exist, mirroring the ObjectStorageService/AiResultsSummaryClient
 * pattern elsewhere in this module:
 *  - FfmpegFrameExtractionService (production, real `ffmpeg-static` binary via `fluent-ffmpeg`)
 *  - FakeFrameExtractionService (test double, src/media/testing/ — never wired into
 *    AppModule) so unit/integration tests don't need to decode a real video file.
 */

export interface ExtractedVideoFrame {
  mimeType: 'image/jpeg';
  data: Buffer;
}

export interface FrameExtractionService {
  /**
   * Returns evenly-spaced still frames sampled from the video, oldest-first. May return
   * fewer than the target count (or none) if the video is too short/corrupt to probe —
   * callers must treat this as "skip what couldn't be extracted," not an error (same
   * fail-closed-per-asset shape as MediaService.getAnalyzablePhotos's decrypt failures).
   */
  extractFrames(video: Buffer, mimeType: string): Promise<ExtractedVideoFrame[]>;
}

export const FRAME_EXTRACTION_SERVICE = Symbol('FRAME_EXTRACTION_SERVICE');
