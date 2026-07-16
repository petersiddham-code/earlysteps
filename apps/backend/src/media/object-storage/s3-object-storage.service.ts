import { Injectable } from '@nestjs/common';
import type { ObjectStorageService } from './object-storage.js';

/**
 * Deliberate stub (issue #134/#133 plan): the repo has no S3/MinIO credentials or config
 * yet, so real S3-compatible wiring — and the aws-sdk dependency it needs — is deferred
 * until a bucket exists. Selecting STORAGE_DRIVER=s3 today fails loudly at first use
 * rather than silently storing nothing.
 */
@Injectable()
export class S3ObjectStorageService implements ObjectStorageService {
  private fail(): never {
    throw new Error(
      'S3 object storage is not implemented yet — set STORAGE_DRIVER=local (issue #134).',
    );
  }

  async put(): Promise<void> {
    this.fail();
  }

  async get(): Promise<Buffer> {
    this.fail();
  }

  async delete(): Promise<void> {
    this.fail();
  }
}
