import { Logger, Module } from '@nestjs/common';
import { OBJECT_STORAGE_SERVICE } from './object-storage.js';
import {
  LocalDiskObjectStorageService,
  mediaStorageDir,
} from './local-disk-object-storage.service.js';
import { S3ObjectStorageService } from './s3-object-storage.service.js';

/**
 * Standalone on purpose (issue #134): both MediaModule and FamiliesModule need the blob
 * store (uploads on one side, right-to-erasure blob purging on the other), and MediaModule
 * itself depends on FamiliesModule for consent checks — so the storage pieces live in
 * their own dependency-free module rather than creating a Families <-> Media cycle.
 *
 * Driver selection mirrors AnalysisModule's client factories: an env var picks the
 * implementation at bootstrap, with the offline-friendly choice as the default.
 */
@Module({
  providers: [
    {
      provide: OBJECT_STORAGE_SERVICE,
      useFactory: () => {
        const driver = process.env.STORAGE_DRIVER ?? 'local';
        if (driver === 's3') return new S3ObjectStorageService();
        new Logger('ObjectStorageModule').log(
          `Media blobs stored on local disk at ${mediaStorageDir()} (STORAGE_DRIVER=local)`,
        );
        return new LocalDiskObjectStorageService();
      },
    },
  ],
  exports: [OBJECT_STORAGE_SERVICE],
})
export class ObjectStorageModule {}
