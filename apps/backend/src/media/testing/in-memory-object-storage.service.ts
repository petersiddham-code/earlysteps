/**
 * Test double ONLY — a Map-backed ObjectStorageService, mirroring the in-memory
 * repository doubles. Never register this in AppModule/ObjectStorageModule providers.
 */
import type { ObjectStorageService } from '../object-storage/object-storage.js';

export class InMemoryObjectStorageService implements ObjectStorageService {
  readonly blobs = new Map<string, Buffer>();
  /** Every delete() call, in order — including keys that no longer existed. */
  readonly deletedKeys: string[] = [];
  /** Test hook: set to make the next delete() calls throw (retention-retry cases). */
  failDeletes = false;

  async put(key: string, data: Buffer): Promise<void> {
    this.blobs.set(key, Buffer.from(data));
  }

  async get(key: string): Promise<Buffer> {
    const blob = this.blobs.get(key);
    if (!blob) throw new Error(`No blob stored at ${key}`);
    return blob;
  }

  async delete(key: string): Promise<void> {
    if (this.failDeletes) throw new Error(`Simulated storage failure deleting ${key}`);
    this.blobs.delete(key);
    this.deletedKeys.push(key);
  }
}
