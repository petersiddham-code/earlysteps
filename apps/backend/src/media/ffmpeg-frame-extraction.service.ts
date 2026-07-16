/**
 * Production FrameExtractionService (issue #139): samples FRAMES_PER_VIDEO evenly-spaced
 * still frames from a decrypted video buffer using a bundled ffmpeg binary (`ffmpeg-static`)
 * via `fluent-ffmpeg` — no system-level ffmpeg install required (scope decision confirmed
 * with the user before implementation: bundled binary over a system dependency).
 *
 * The video is written to a scratch temp file only for the duration of one extraction call
 * and always removed afterward (finally-block cleanup, same discipline as the decrypted
 * bytes in MediaService.getAnalyzablePhotos never touching disk) — this backend never
 * persists a decrypted video or its derived frames anywhere (rule 9, §2; the user's
 * "on-demand, discarded after the call" scope decision).
 */
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpegStaticPath from 'ffmpeg-static';
import ffprobeStatic from '@ffprobe-installer/ffprobe';
import ffmpeg from 'fluent-ffmpeg';
import { Injectable, Logger } from '@nestjs/common';
import type { ExtractedVideoFrame, FrameExtractionService } from './frame-extraction.js';

// ffmpeg-static bundles only the `ffmpeg` binary, not `ffprobe` — duration probing (needed
// to compute the evenly-spaced sample timestamps below) needs the separate, equally
// bundled-binary-no-system-install `@ffprobe-installer/ffprobe` package.
if (ffmpegStaticPath) ffmpeg.setFfmpegPath(ffmpegStaticPath);
ffmpeg.setFfprobePath(ffprobeStatic.path);

/**
 * Sample count and spacing, agreed with the user before implementation: 3 frames,
 * evenly spaced. Fractions avoid the exact 0.0 and 1.0 endpoints — seeking to the very
 * last instant of a clip is a common ffmpeg edge-case failure, and the start/end of a
 * recording is often a caregiver fumbling with the capture button rather than the
 * behaviour being documented.
 */
export const FRAMES_PER_VIDEO = 3;
const SAMPLE_FRACTIONS = [0.15, 0.5, 0.85] as const;

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

@Injectable()
export class FfmpegFrameExtractionService implements FrameExtractionService {
  private readonly logger = new Logger(FfmpegFrameExtractionService.name);

  async extractFrames(video: Buffer, mimeType: string): Promise<ExtractedVideoFrame[]> {
    const dir = await mkdtemp(join(tmpdir(), 'earlysteps-frame-'));
    const extension = EXTENSION_BY_MIME_TYPE[mimeType] ?? 'mp4';
    const inputPath = join(dir, `${randomUUID()}.${extension}`);
    try {
      await writeFile(inputPath, video);
      const duration = await this.probeDurationSeconds(inputPath);
      if (duration === null || duration <= 0) return [];

      const frames: ExtractedVideoFrame[] = [];
      for (let i = 0; i < SAMPLE_FRACTIONS.length; i++) {
        const timestampSeconds = duration * SAMPLE_FRACTIONS[i]!;
        const outputPath = join(dir, `${randomUUID()}.jpg`);
        try {
          await this.extractFrameAt(inputPath, timestampSeconds, outputPath);
          frames.push({ mimeType: 'image/jpeg', data: await readFile(outputPath) });
        } catch (error) {
          // Fail closed per-frame, not for the whole video — one bad seek shouldn't
          // discard the other sampled frames (same precedent as photo decrypt failures).
          this.logger.warn(
            `frame extraction failed at ${timestampSeconds.toFixed(1)}s — skipping this frame`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }
      return frames;
    } catch (error) {
      // Fail closed for the whole video (e.g. corrupt/undecodable file) — the caller
      // treats an empty array the same as "no video evidence available."
      this.logger.warn(
        'frame extraction failed for this video — skipping',
        error instanceof Error ? error.stack : String(error),
      );
      return [];
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }

  private probeDurationSeconds(inputPath: string): Promise<number | null> {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(inputPath, (error, data) => {
        if (error) {
          resolve(null);
          return;
        }
        const duration = data.format.duration;
        resolve(
          typeof duration === 'number' && Number.isFinite(duration) ? duration : null,
        );
      });
    });
  }

  private extractFrameAt(
    inputPath: string,
    timestampSeconds: number,
    outputPath: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(timestampSeconds)
        .frames(1)
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (error: Error) => reject(error))
        .run();
    });
  }
}
