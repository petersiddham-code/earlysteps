import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Injectable } from '@nestjs/common';
import type { ObjectStorageService } from './object-storage.js';

/** Local driver's blob directory — override with MEDIA_STORAGE_DIR (see .env.example). */
export function mediaStorageDir(): string {
  return resolve(process.cwd(), process.env.MEDIA_STORAGE_DIR ?? 'data/media');
}

/**
 * Dev/default object storage (STORAGE_DRIVER=local): encrypted blobs as flat files under
 * a gitignored data directory. Every byte written here has already been through
 * MediaEncryptionService — nothing lands on disk in plaintext (product plan §4.7).
 */
@Injectable()
export class LocalDiskObjectStorageService implements ObjectStorageService {
  constructor(private readonly rootDir: string = mediaStorageDir()) {}

  /**
   * Keys are generated server-side (never client input), but resolve-and-check anyway so
   * a bug elsewhere can never turn a key into a path-traversal write outside the root.
   */
  private pathFor(key: string): string {
    const path = resolve(this.rootDir, key);
    if (path !== this.rootDir && !path.startsWith(this.rootDir + sep)) {
      throw new Error(`Storage key escapes the media directory: ${key}`);
    }
    return path;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  async delete(key: string): Promise<void> {
    // force: a key whose blob is already gone is a successful delete, not an error —
    // the retention job may retry a half-finished delete (see MediaAsset.deletedAt).
    await rm(this.pathFor(key), { force: true });
  }
}
