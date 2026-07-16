/**
 * Port (interface) for the encrypted-blob store behind media capture (issue #134).
 * Implementations:
 *  - LocalDiskObjectStorageService (dev default — encrypted blobs under a gitignored
 *    directory)
 *  - S3ObjectStorageService (stub — real S3-compatible wiring is a config swap later,
 *    per the issue #133 plan, not a rewrite)
 *  - tests use a trivial in-memory fake
 *
 * Deliberately dumb: keys are opaque, values are already-encrypted bytes (the
 * MediaEncryptionService runs before anything reaches `put`), and nothing here knows
 * about children, families, consent, or encryption.
 */

export const OBJECT_STORAGE_SERVICE = Symbol('OBJECT_STORAGE_SERVICE');

export interface ObjectStorageService {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
