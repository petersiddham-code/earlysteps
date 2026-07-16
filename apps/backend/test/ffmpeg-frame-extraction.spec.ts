/**
 * Unit tests for the production FrameExtractionService (issue #139, Phase 3): the one piece
 * of this phase that talks to a real external process (the bundled `ffmpeg-static` binary),
 * so it's tested against a real (synthetically generated, not committed to the repo) video
 * rather than only through FakeFrameExtractionService's stand-in used everywhere else.
 *
 * Generates a tiny throwaway clip at test time by piping raw video frames into ffmpeg's
 * rawvideo demuxer + libx264 encoder — core codec features present in every ffmpeg-static
 * build, unlike the `lavfi` test-pattern INPUT DEVICE (from libavdevice), which some
 * platform builds of ffmpeg-static (observed: Linux CI) compile out. No binary fixture
 * checked into the repo; deterministic across machines/CI.
 */
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import ffmpegStaticPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import { FfmpegFrameExtractionService } from '../src/media/ffmpeg-frame-extraction.service.js';

if (ffmpegStaticPath) ffmpeg.setFfmpegPath(ffmpegStaticPath);

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

const CLIP_WIDTH = 64;
const CLIP_HEIGHT = 64;
const CLIP_FPS = 10;
const CLIP_SECONDS = 2;

/** A readable stream of solid-color raw RGB24 frames, each a different shade. */
function rawFrameStream(): Readable {
  const frameBytes = CLIP_WIDTH * CLIP_HEIGHT * 3;
  const frameCount = CLIP_FPS * CLIP_SECONDS;
  let i = 0;
  return new Readable({
    read() {
      if (i >= frameCount) {
        this.push(null);
        return;
      }
      this.push(Buffer.alloc(frameBytes, (i * 25) % 256));
      i += 1;
    },
  });
}

/** Generates a 2-second synthetic clip with a real, probeable duration. */
function generateTestClip(outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(rawFrameStream())
      .inputFormat('rawvideo')
      .inputOptions([
        '-pix_fmt',
        'rgb24',
        '-s',
        `${CLIP_WIDTH}x${CLIP_HEIGHT}`,
        '-r',
        String(CLIP_FPS),
      ])
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
