/**
 * Unit tests for the production FrameExtractionService (issue #139, Phase 3): the one piece
 * of this phase that talks to a real external process (the bundled `ffmpeg-static` binary),
 * so it's tested against a real (synthetically generated, not committed to the repo) video
 * rather than only through FakeFrameExtractionService's stand-in used everywhere else.
 *
 * Generates a tiny throwaway clip with ffmpeg's `lavfi` test-pattern source at test time —
 * no binary fixture checked into the repo, deterministic across machines/CI.
 */
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import ffmpegStaticPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import { FfmpegFrameExtractionService } from '../src/media/ffmpeg-frame-extraction.service.js';

if (ffmpegStaticPath) ffmpeg.setFfmpegPath(ffmpegStaticPath);

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

/** Generates a 2-second synthetic color-bar clip with a real, probeable duration. */
function generateTestClip(outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input('testsrc=duration=2:size=64x64:rate=10')
      .inputFormat('lavfi')
      .output(outputPath)
      .outputOptions(['-pix_fmt', 'yuv420p'])
      .on('end', () => resolve())
      .on('error', (error: Error) => reject(error))
      .run();
  });
}

describe('FfmpegFrameExtractionService (issue #139)', () => {
  let dir: string;
  let clipPath: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'earlysteps-test-clip-'));
    clipPath = join(dir, 'clip.mp4');
    await generateTestClip(clipPath);
  }, 30_000);

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('extracts 3 evenly-spaced, valid JPEG frames from a real video', async () => {
    const service = new FfmpegFrameExtractionService();
    const video = await readFile(clipPath);

    const frames = await service.extractFrames(video, 'video/mp4');

    expect(frames).toHaveLength(3);
    for (const frame of frames) {
      expect(frame.mimeType).toBe('image/jpeg');
      expect(frame.data.subarray(0, 3)).toEqual(JPEG_MAGIC);
      expect(frame.data.length).toBeGreaterThan(0);
    }
  }, 30_000);

  it('returns an empty array, not a throw, for undecodable bytes', async () => {
    const service = new FfmpegFrameExtractionService();

    const frames = await service.extractFrames(
      Buffer.from('not-a-real-video-file'),
      'video/mp4',
    );

    expect(frames).toEqual([]);
  }, 15_000);

  it('cleans up its temp working directory after extraction', async () => {
    const service = new FfmpegFrameExtractionService();
    const video = await readFile(clipPath);
    const countScratchDirs = async () =>
      (await readdir(tmpdir())).filter((e) => e.startsWith('earlysteps-frame-')).length;
    const before = await countScratchDirs();

    await service.extractFrames(video, 'video/mp4');

    expect(await countScratchDirs()).toBe(before);
  }, 30_000);
});
