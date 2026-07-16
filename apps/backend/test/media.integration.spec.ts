/**
 * Integration tests for media capture, Phase 1 (issue #134): the consent gate (CLAUDE.md
 * §2 rule 9 — no code path stores media without media_capture consent), the encrypted
 * upload round-trip, lazy per-family keys, parent delete-now, the 90-day retention
 * sweep's date boundaries (mirroring how scoring-engine tests bucket boundaries), and
 * blob purging on family erasure (issue #55).
 *
 * Runs against the in-memory repositories and object-storage fake — no live Postgres,
 * no disk writes. Tier/ownership guards are HTTP-layer concerns covered in
 * media.http.spec.ts, mirroring the analysis test split.
 */
import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FamiliesService } from '../src/families/families.service.js';
import { FAMILIES_REPOSITORY } from '../src/families/families.repository.js';
import { InMemoryFamiliesRepository } from '../src/families/testing/in-memory-families.repository.js';
import { MediaService, MEDIA_RETENTION_DAYS } from '../src/media/media.service.js';
import { MEDIA_REPOSITORY } from '../src/media/media.repository.js';
import { MediaEncryptionService } from '../src/media/media-encryption.service.js';
import { OBJECT_STORAGE_SERVICE } from '../src/media/object-storage/object-storage.js';
import { InMemoryMediaRepository } from '../src/media/testing/in-memory-media.repository.js';
import { InMemoryObjectStorageService } from '../src/media/testing/in-memory-object-storage.service.js';
import { FRAME_EXTRACTION_SERVICE } from '../src/media/frame-extraction.js';
import { FakeFrameExtractionService } from '../src/media/testing/fake-frame-extraction.service.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const PHOTO_BYTES = Buffer.from('pretend-jpeg-bytes-'.repeat(20));

async function buildStack() {
  const familiesRepository = new InMemoryFamiliesRepository();
  const mediaRepository = new InMemoryMediaRepository();
  const storage = new InMemoryObjectStorageService();
  const encryption = new MediaEncryptionService();
  const frameExtraction = new FakeFrameExtractionService();
  const moduleRef = await Test.createTestingModule({
    providers: [
      MediaService,
      FamiliesService,
      { provide: MEDIA_REPOSITORY, useValue: mediaRepository },
      { provide: FAMILIES_REPOSITORY, useValue: familiesRepository },
      { provide: OBJECT_STORAGE_SERVICE, useValue: storage },
      { provide: MediaEncryptionService, useValue: encryption },
      { provide: FRAME_EXTRACTION_SERVICE, useValue: frameExtraction },
    ],
  }).compile();
  return {
    mediaService: moduleRef.get(MediaService),
    familiesService: moduleRef.get(FamiliesService),
    familiesRepository,
    mediaRepository,
    storage,
    encryption,
    frameExtraction,
  };
}

describe('media upload — media_capture consent gate (CLAUDE.md §2 rule 9)', () => {
  it('refuses without media_capture consent — nothing written to storage or the DB', async () => {
    const { mediaService, familiesRepository, mediaRepository, storage } =
      await buildStack();
    // data_storage alone must never substitute for the media scope.
    const { child } = await familiesRepository.seedChildWithConsent(['data_storage']);

    await expect(
      mediaService.upload(child.id, {
        kind: 'photo',
        mimeType: 'image/jpeg',
        data: PHOTO_BYTES,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(storage.blobs.size).toBe(0);
    expect(mediaRepository.allAssets()).toEqual([]);
  });

  it('an unknown child fails safe (no consent on record -> 403)', async () => {
    const { mediaService, storage } = await buildStack();
    await expect(
      mediaService.upload('no-such-child', {
        kind: 'audio',
        mimeType: 'audio/m4a',
        data: PHOTO_BYTES,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(storage.blobs.size).toBe(0);
  });
});

describe('media upload — encrypted storage round-trip', () => {
  it('stores an encrypted blob (never plaintext) that the family key decrypts back', async () => {
    const { mediaService, familiesRepository, mediaRepository, storage, encryption } =
      await buildStack();
    const { family, child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'media_capture',
    ]);

    const asset = await mediaService.upload(child.id, {
      kind: 'photo',
      mimeType: 'image/jpeg',
      data: PHOTO_BYTES,
    });

    expect(asset.childId).toBe(child.id);
    expect(asset.kind).toBe('photo');
    expect(asset.mimeType).toBe('image/jpeg');
    expect(asset.consentId).toBeTruthy();
    expect(asset.deletedAt).toBeNull();
    expect(asset.retainedByParent).toBe(false);

    const stored = await storage.get(asset.storageKey);
    expect(stored.equals(PHOTO_BYTES)).toBe(false);
    expect(stored.includes(Buffer.from('pretend-jpeg-bytes-'))).toBe(false);

    const key = await mediaRepository.getFamilyMediaKey(family.id);
    expect(key).toBeTruthy();
    expect(encryption.decrypt(key!, stored, child.id).equals(PHOTO_BYTES)).toBe(true);
  });

  it('generates the per-family key lazily on first upload and reuses it after', async () => {
    const { mediaService, familiesRepository, mediaRepository } = await buildStack();
    const { family, child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'media_capture',
    ]);
    expect(await mediaRepository.getFamilyMediaKey(family.id)).toBeNull();

    await mediaService.upload(child.id, {
      kind: 'photo',
      mimeType: 'image/jpeg',
      data: PHOTO_BYTES,
    });
    const keyAfterFirst = await mediaRepository.getFamilyMediaKey(family.id);
    expect(keyAfterFirst).toBeTruthy();

    await mediaService.upload(child.id, {
      kind: 'video',
      mimeType: 'video/mp4',
      data: PHOTO_BYTES,
    });
    expect(await mediaRepository.getFamilyMediaKey(family.id)).toBe(keyAfterFirst);
  });

  it('mints a fresh consentId per capture (per-instance consent, rule 9)', async () => {
    const { mediaService, familiesRepository } = await buildStack();
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'media_capture',
    ]);
    const first = await mediaService.upload(child.id, {
      kind: 'photo',
      mimeType: 'image/jpeg',
      data: PHOTO_BYTES,
    });
    const second = await mediaService.upload(child.id, {
      kind: 'photo',
      mimeType: 'image/jpeg',
      data: PHOTO_BYTES,
    });
    expect(first.consentId).not.toBe(second.consentId);
  });

  it('sets retentionExpiresAt exactly 90 days after capturedAt', async () => {
    const { mediaService, familiesRepository } = await buildStack();
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'media_capture',
    ]);
    const capturedAt = '2026-07-01T12:00:00.000Z';
    const asset = await mediaService.upload(child.id, {
      kind: 'audio',
      mimeType: 'audio/m4a',
      data: PHOTO_BYTES,
      capturedAt,
    });
    expect(asset.capturedAt).toBe(capturedAt);
    expect(new Date(asset.retentionExpiresAt).getTime()).toBe(
      new Date(capturedAt).getTime() + MEDIA_RETENTION_DAYS * DAY_MS,
    );
  });

  it('clamps a claimed future capturedAt to now — no stretching the retention window', async () => {
    const { mediaService, familiesRepository } = await buildStack();
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'media_capture',
    ]);
    const before = Date.now();
    const asset = await mediaService.upload(child.id, {
      kind: 'photo',
      mimeType: 'image/jpeg',
      data: PHOTO_BYTES,
      capturedAt: new Date(Date.now() + 365 * DAY_MS).toISOString(),
    });
    expect(new Date(asset.capturedAt).getTime()).toBeGreaterThanOrEqual(before);
    expect(new Date(asset.capturedAt).getTime()).toBeLessThanOrEqual(Date.now());
  });
});

describe('media retention window — parent-facing setting (issue #142)', () => {
  it('a fresh capture uses the family default of 90 days', async () => {
    const { mediaService, familiesRepository } = await buildStack();
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'media_capture',
    ]);
    const capturedAt = '2026-07-01T12:00:00.000Z';
    const asset = await mediaService.upload(child.id, {
      kind: 'photo',
      mimeType: 'image/jpeg',
      data: PHOTO_BYTES,
      capturedAt,
    });
    expect(new Date(asset.retentionExpiresAt).getTime()).toBe(
      new Date(capturedAt).getTime() + 90 * DAY_MS,
    );
  });

  it('a capture after the family shortens the window uses the new setting', async () => {
    const { mediaService, familiesRepository } = await buildStack();
    const { family, child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'media_capture',
    ]);
    await familiesRepository.updateMediaRetentionDays(family.id, 30);

    const capturedAt = '2026-07-01T12:00:00.000Z';
    const asset = await mediaService.upload(child.id, {
      kind: 'photo',
      mimeType: 'image/jpeg',
      data: PHOTO_BYTES,
      capturedAt,
    });
    expect(new Date(asset.retentionExpiresAt).getTime()).toBe(
      new Date(capturedAt).getTime() + 30 * DAY_MS,
    );
  });

  it('shortening the window retroactively recomputes an already-captured, non-retained asset', async () => {
    const stack = await buildStack();
    const { familiesRepository, mediaRepository, mediaService } = stack;
    // Production recomputes retentionExpiresAt on the same DB the media rows live in
    // (PrismaFamiliesRepository.updateMediaRetentionDays); wire the doubles the same way
    // family erasure does for storage keys.
    familiesRepository.onUpdateMediaRetentionForFamily = async (familyId, days) => {
      const children = await familiesRepository.getChildrenByFamily(familyId);
      mediaRepository.recomputeRetentionForChildren(
        children.map((c) => c.id),
        days,
      );
    };
    const { family, child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'media_capture',
    ]);
    const capturedAt = '2026-07-01T12:00:00.000Z';
    const asset = await mediaService.upload(child.id, {
      kind: 'photo',
      mimeType: 'image/jpeg',
      data: PHOTO_BYTES,
      capturedAt,
    });
    expect(new Date(asset.retentionExpiresAt).getTime()).toBe(
      new Date(capturedAt).getTime() + 90 * DAY_MS,
    );

    await familiesRepository.updateMediaRetentionDays(family.id, 30);

    const [updated] = await mediaService.list(child.id);
    expect(new Date(updated.retentionExpiresAt).getTime()).toBe(
      new Date(capturedAt).getTime() + 30 * DAY_MS,
    );
  });

  it('never shortens an asset the parent chose to retain', async () => {
    const stack = await buildStack();
    const { familiesRepository, mediaRepository, mediaService } = stack;
    familiesRepository.onUpdateMediaRetentionForFamily = async (familyId, days) => {
      const children = await familiesRepository.getChildrenByFamily(familyId);
      mediaRepository.recomputeRetentionForChildren(
        children.map((c) => c.id),
        days,
      );
    };
    const { family, child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'media_capture',
    ]);
    const asset = await mediaService.upload(child.id, {
      kind: 'photo',
      mimeType: 'image/jpeg',
      data: PHOTO_BYTES,
      capturedAt: '2026-07-01T12:00:00.000Z',
    });
    const originalExpiry = asset.retentionExpiresAt;
    mediaRepository.patchAsset(asset.id, { retainedByParent: true });

    await familiesRepository.updateMediaRetentionDays(family.id, 30);

    const [unchanged] = await mediaService.list(child.id);
    expect(unchanged.retentionExpiresAt).toBe(originalExpiry);
  });
});

describe('media list + parent delete-now', () => {
  it('lists stored media and hard-deletes (blob + row) on request', async () => {
    const { mediaService, familiesRepository, mediaRepository, storage } =
      await buildStack();
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'media_capture',
    ]);
    const asset = await mediaService.upload(child.id, {
      kind: 'video',
      mimeType: 'video/mp4',
      data: PHOTO_BYTES,
    });
    expect(await mediaService.list(child.id)).toHaveLength(1);

    await mediaService.deleteNow(child.id, asset.id);

    expect(await mediaService.list(child.id)).toEqual([]);
    expect(storage.blobs.size).toBe(0);
    expect(mediaRepository.allAssets()).toEqual([]);
  });

  it("404s on an unknown mediaId or another child's asset", async () => {
    const { mediaService, familiesRepository } = await buildStack();
    const { child } = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'media_capture',
    ]);
    const other = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'media_capture',
    ]);
    const asset = await mediaService.upload(child.id, {
      kind: 'photo',
      mimeType: 'image/jpeg',
      data: PHOTO_BYTES,
    });

    await expect(mediaService.deleteNow(child.id, 'nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(mediaService.deleteNow(other.child.id, asset.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(await mediaService.list(child.id)).toHaveLength(1);
  });
});

describe('retention sweep — 90-day hard deletion (product plan §4.7)', () => {
  async function seedAsset(
    stack: Awaited<ReturnType<typeof buildStack>>,
    patch: { retentionExpiresAt?: string; retainedByParent?: boolean } = {},
  ) {
    const { child } = await stack.familiesRepository.seedChildWithConsent([
      'data_storage',
      'media_capture',
    ]);
    const asset = await stack.mediaService.upload(child.id, {
      kind: 'photo',
      mimeType: 'image/jpeg',
      data: PHOTO_BYTES,
    });
    stack.mediaRepository.patchAsset(asset.id, patch);
    return asset;
  }

  it('deletes an asset expiring exactly at the sweep instant (boundary is inclusive)', async () => {
    const stack = await buildStack();
    const now = new Date('2026-10-01T00:00:00.000Z');
    const asset = await seedAsset(stack, { retentionExpiresAt: now.toISOString() });

    await stack.mediaService.purgeExpired(now);

    expect(stack.mediaRepository.allAssets()).toEqual([]);
    expect(stack.storage.deletedKeys).toContain(asset.storageKey);
  });

  it('keeps an asset expiring 1ms after the sweep instant', async () => {
    const stack = await buildStack();
    const now = new Date('2026-10-01T00:00:00.000Z');
    await seedAsset(stack, {
      retentionExpiresAt: new Date(now.getTime() + 1).toISOString(),
    });

    await stack.mediaService.purgeExpired(now);

    expect(stack.mediaRepository.allAssets()).toHaveLength(1);
    expect(stack.storage.blobs.size).toBe(1);
  });

  it('never deletes an expired asset the parent chose to retain', async () => {
    const stack = await buildStack();
    const now = new Date('2026-10-01T00:00:00.000Z');
    await seedAsset(stack, {
      retentionExpiresAt: new Date(now.getTime() - 30 * DAY_MS).toISOString(),
      retainedByParent: true,
    });

    await stack.mediaService.purgeExpired(now);

    expect(stack.mediaRepository.allAssets()).toHaveLength(1);
    expect(stack.storage.blobs.size).toBe(1);
  });

  it('sweeps a tombstoned row left by a half-finished delete', async () => {
    const stack = await buildStack();
    const asset = await seedAsset(stack);
    // Simulate a delete-now that crashed between tombstone and row removal.
    await stack.mediaRepository.markDeleted(asset.id, new Date());

    await stack.mediaService.purgeExpired(new Date());

    expect(stack.mediaRepository.allAssets()).toEqual([]);
    expect(stack.storage.blobs.size).toBe(0);
  });

  it('keeps the row for a retry when the blob delete fails', async () => {
    const stack = await buildStack();
    const now = new Date('2026-10-01T00:00:00.000Z');
    await seedAsset(stack, {
      retentionExpiresAt: new Date(now.getTime() - DAY_MS).toISOString(),
    });

    stack.storage.failDeletes = true;
    await stack.mediaService.purgeExpired(now);
    expect(stack.mediaRepository.allAssets()).toHaveLength(1);

    stack.storage.failDeletes = false;
    await stack.mediaService.purgeExpired(now);
    expect(stack.mediaRepository.allAssets()).toEqual([]);
  });
});

describe('family erasure purges media blobs too (issue #55 + #134)', () => {
  it('deleteFamily removes every blob stored under that family, and only that family', async () => {
    const stack = await buildStack();
    const { familiesService, familiesRepository, mediaRepository, storage } = stack;
    // Production deletes media rows inside the same DB; wire the doubles the same way.
    familiesRepository.onListMediaStorageKeys = async (familyId) => {
      const children = await familiesRepository.getChildrenByFamily(familyId);
      const childIds = new Set(children.map((c) => c.id));
      return mediaRepository
        .allAssets()
        .filter((a) => childIds.has(a.childId))
        .map((a) => a.storageKey);
    };

    const mine = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'media_capture',
    ]);
    const other = await familiesRepository.seedChildWithConsent([
      'data_storage',
      'media_capture',
    ]);
    await stack.mediaService.upload(mine.child.id, {
      kind: 'photo',
      mimeType: 'image/jpeg',
      data: PHOTO_BYTES,
    });
    const kept = await stack.mediaService.upload(other.child.id, {
      kind: 'audio',
      mimeType: 'audio/m4a',
      data: PHOTO_BYTES,
    });
    expect(storage.blobs.size).toBe(2);

    await familiesService.deleteFamily(mine.family.id);

    expect(storage.blobs.size).toBe(1);
    expect([...storage.blobs.keys()]).toEqual([kept.storageKey]);
  });
});
